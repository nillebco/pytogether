resource "hcloud_ssh_key" "default" {
  name       = "pytogether_key"
  public_key = file(var.ssh_key_path)
}

