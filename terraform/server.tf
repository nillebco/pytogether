resource "hcloud_server" "backend" {
  name        = "pytogether-backend"
  image       = var.os_type
  server_type = var.server_type
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.default.id]

  user_data = templatefile("${path.module}/user_data.yml", {
    SSH_KEY_CONTENT = file(var.ssh_key_path)
  })

  labels = {
    project = "pytogether"
    type    = "backend"
  }
}

