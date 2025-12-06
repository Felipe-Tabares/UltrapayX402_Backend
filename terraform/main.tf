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

# Build Lambda package: npm install + zip
resource "null_resource" "lambda_build" {
  triggers = {
    # Re-build cuando cambie package.json
    package_hash = filesha256("${path.module}/../package.json")
  }

  provisioner "local-exec" {
    command     = "npm install --production --omit=dev"
    working_dir = "${path.module}/.."
  }
}

# Crear zip del directorio completo (mas eficiente)
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/.."
  output_path = "${path.module}/../dist.zip"

  excludes = [
    "terraform",
    "terraform/*",
    "terraform/**/*",
    ".git",
    ".git/*",
    ".git/**/*",
    ".gitignore",
    "README.md",
    "CLAUDE.md",
    "*.md",
    ".env",
    ".env.*",
    "dist.zip",
    "tests",
    "tests/*",
    "test",
    "test/*"
  ]

  depends_on = [null_resource.lambda_build]
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
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy para Lambda (S3 + DynamoDB + CloudWatch)
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
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "api" {
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "${var.project_name}-api-${var.environment}"
  role             = aws_iam_role.lambda_role.arn
  handler          = "src/index.handler"
  runtime          = "nodejs20.x"
  timeout          = 120
  memory_size      = 512

  environment {
    variables = {
      S3_BUCKET              = aws_s3_bucket.media.id
      DYNAMO_TABLE           = aws_dynamodb_table.transactions.id
      X402_FACILITATOR_URL   = var.x402_facilitator_url
      X402_WALLET_ADDRESS    = var.x402_wallet_address
      X402_NETWORK           = var.x402_network
      NODE_ENV               = var.environment
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# API Gateway
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["*"]
    allow_methods  = ["GET", "POST", "OPTIONS"]
    allow_headers  = ["Content-Type", "X-Payment", "x402-payment", "X-PAYMENT"]
    expose_headers = ["X-Payment-Response", "x-payment-response"]
    max_age        = 3600
  }
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Permission para API Gateway invocar Lambda
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
