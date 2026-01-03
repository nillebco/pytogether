variable "hcloud_token" {
  description = "Hetzner Cloud API token"
  sensitive   = true
}

variable "location" {
  description = "Hetzner Cloud location"
  default     = "nbg1"
}

variable "server_type" {
  description = "Hetzner Cloud server type"
  default     = "cax11"
}

variable "os_type" {
  description = "Operating system image"
  default     = "ubuntu-24.04"
}

variable "ssh_key_path" {
  description = "Path to SSH public key"
  default     = "~/.ssh/id_rsa.pub"
}

variable "my_ip_address" {
  description = "Your IP address for SSH firewall restriction (optional)"
  default     = null
  type        = string
}

