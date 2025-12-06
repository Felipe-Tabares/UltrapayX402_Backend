variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "ultrapay"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "x402_facilitator_url" {
  description = "x402 Facilitator URL"
  type        = string
  default     = "https://facilitator.ultravioletadao.xyz/"
}

variable "x402_wallet_address" {
  description = "x402 Wallet address for receiving payments"
  type        = string
  default     = "0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8"
}

variable "x402_network" {
  description = "x402 Network (base-sepolia for testnet, base for mainnet)"
  type        = string
  default     = "base-sepolia"
}
