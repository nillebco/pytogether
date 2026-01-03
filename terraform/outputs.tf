output "service_ip" {
  value       = hcloud_server.backend.ipv4_address
  description = "IPv4 address of the backend server"
}

output "server_name" {
  value       = hcloud_server.backend.name
  description = "Name of the backend server"
}

output "ssh_command" {
  value       = "ssh devops@${hcloud_server.backend.ipv4_address}"
  description = "SSH command to connect to the server"
}

