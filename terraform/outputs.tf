output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_api.api.api_endpoint}/${aws_apigatewayv2_stage.api.name}"
}

output "s3_bucket" {
  description = "S3 bucket name for media storage"
  value       = aws_s3_bucket.media.id
}

output "dynamodb_table" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.transactions.id
}

output "lambda_function" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}
