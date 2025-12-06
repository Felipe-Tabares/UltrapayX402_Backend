terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}

provider "aws" {
  region = var.aws_region
}

# ECR Repository para la imagen Docker
resource "aws_ecr_repository" "lambda" {
  name                 = "${var.project_name}-api-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }
}

# S3 Bucket para almacenar imágenes/videos generados
resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-media-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# DynamoDB Table para transacciones
resource "aws_dynamodb_table" "transactions" {
  name           = "${var.project_name}-transactions-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "transactionId"

  attribute {
    name = "transactionId"
    type = "S"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# IAM Role para Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Política para logs de CloudWatch
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Política adicional para S3 y DynamoDB
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]
        Resource = aws_dynamodb_table.transactions.arn
      }
    ]
  })
}

# Build y push de la imagen Docker
resource "null_resource" "docker_build" {
  triggers = {
    dockerfile = filemd5("${path.module}/../Dockerfile")
    source_hash = sha256(join("", [
      file("${path.module}/../src/index.js"),
      file("${path.module}/../src/config/index.js"),
      file("${path.module}/../src/handlers/generate.js"),
      file("${path.module}/../src/handlers/health.js"),
      file("${path.module}/../src/services/ai.js"),
      file("${path.module}/../src/services/storage.js"),
      file("${path.module}/../package.json")
    ]))
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = <<EOT
      $ErrorActionPreference = 'Stop'

      Write-Host "========== BUILD DOCKER IMAGE =========="

      # Login a ECR
      Write-Host "Login a ECR..."
      aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.lambda.repository_url}

      # Build
      Write-Host "Building Docker image..."
      docker build -t ${aws_ecr_repository.lambda.repository_url}:latest .

      # Push
      Write-Host "Pushing to ECR..."
      docker push ${aws_ecr_repository.lambda.repository_url}:latest

      Write-Host "========== DOCKER BUILD COMPLETADO =========="
    EOT
    interpreter = ["powershell", "-Command"]
  }

  depends_on = [aws_ecr_repository.lambda]
}

# Esperar después del build
resource "time_sleep" "wait_for_docker" {
  depends_on      = [null_resource.docker_build]
  create_duration = "10s"
}

# Función Lambda (Container Image)
resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api-${var.environment}"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lambda.repository_url}:latest"
  timeout       = 120
  memory_size   = 512

  environment {
    variables = {
      S3_BUCKET            = aws_s3_bucket.media.id
      DYNAMO_TABLE         = aws_dynamodb_table.transactions.id
      X402_FACILITATOR_URL = var.x402_facilitator_url
      X402_WALLET_ADDRESS  = var.x402_wallet_address
      X402_NETWORK         = var.x402_network
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    time_sleep.wait_for_docker,
    aws_iam_role_policy_attachment.lambda_logs,
    aws_iam_role_policy.lambda_policy,
  ]

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-api-${var.environment}"
  retention_in_days = 14
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["*"]
    allow_methods  = ["GET", "POST", "OPTIONS"]
    allow_headers  = ["Content-Type", "X-Payment", "x402-payment", "X-PAYMENT", "Authorization"]
    expose_headers = ["X-Payment-Response", "x-payment-response"]
    max_age        = 3600
  }
}

# Integración con Lambda
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

# Ruta default (catch-all)
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Stage de API Gateway
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true
}

# Permisos para que API Gateway invoque Lambda
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
