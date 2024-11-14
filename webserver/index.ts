import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();

const size = "t2.micro";     // t2.micro is available in the AWS free tier
const ami = aws.ec2.getAmiOutput({
    filters: [{
        name: "name",
        values: ["amzn2-ami-hvm-*"],
    }],
    owners: ["137112412989"], // This owner ID is Amazon
    mostRecent: true,
});

const keyPair = new aws.ec2.KeyPair("my-key-pair", {
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICjnqVuSdY+e8WdmL+S6Ki0LURpbNPzJPX+c7yiwlHzZ bnichols@fun",
});

const group = new aws.ec2.SecurityGroup("webserver-secgrp", {
    ingress: [
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
        { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
        // { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
    ],
});

const userData = pulumi.interpolate `#!/bin/bash
mkdir webroot
cat - > webroot/index.html <<EOD
<html>
<head>
<title>Hello World</title>
</head>
<body>
<h1>Hello World!</h1>
</body>
</html>
EOD
cat - > redir.py <<EOD
import http.server
import ssl


class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
      if 'Host' not in self.headers:
        self.send_response(400)

      host_port = self.headers['Host'].split(':')

      if len(host_port) < 1:
        self.send_response(400)

      self.send_response(301)
      self.send_header('Location','https://' + host_port[0])
      self.end_headers()

server_address = ("0.0.0.0", 80)
httpd = http.server.HTTPServer(server_address, MyHandler)

httpd.serve_forever()
EOD
cat - > serv.py <<EOD
import http.server
import ssl


def get_ssl_context(certfile, keyfile):
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile, keyfile)
    ciphers = ['DHE-RSA-AES128-GCM-SHA256', 'DHE-RSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-RSA-CHACHA20-POLY1305', 'AES128-GCM-SHA256', 'AES256-GCM-SHA384', 'DHE-RSA-AES256-SHA256', 'ECDHE-RSA-AES128-SHA256', 'AES256-GCM-SHA384', 'AES128-GCM-SHA256', 'AES256-SHA256', 'AES128-SHA256']
    ciphers_str = ":".join(ciphers)
    context.set_ciphers(ciphers_str)
    return context


class MyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs, directory='webroot')

server_address = ("0.0.0.0", 443)
httpd = http.server.HTTPServer(server_address, MyHandler)

context = get_ssl_context("cert.pem", "key.pem")
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

httpd.serve_forever()
EOD
cat - > cert.pem <<EOD
-----BEGIN CERTIFICATE-----
MIIEgDCCAmigAwIBAgIIDWv/Kw09KgQwDQYJKoZIhvcNAQELBQAwUjELMAkGA1UE
BhMCVVMxFDASBgNVBAoMC1Vuc3BlY2lmaWVkMR8wHQYDVQQLDBZjYS01Nzg4Mzc4
NDEwMTg2MTM2MzQxMQwwCgYDVQQDDANmdW4wHhcNMjQxMTEzMTc0MjAyWhcNMjUx
MjE2MTc0MjAyWjAxMQswCQYDVQQGEwJVUzEUMBIGA1UECgwLVW5zcGVjaWZpZWQx
DDAKBgNVBAMMA2Z1bjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKVX
ZXDRVcSFVgLWo3ULIBTj1JVuK7xe3Ih3EoG4Eo+a8+mrLeXrn6FMWtl2YvuGzSD+
SGIDl54k59Tq+0gvz9riCKya/WwA7wuRAY+mjFCVlm6oM6zvn/zqKoitFaA3E9t/
kBTCQJAe2xfbXR3ylPkBiR/uGmRIQY8KHeWVET5rtOhg7ha/piMUy77BTDO+NtXC
3ZxxDXoDvIeUUbvZsKC9TL8/Jdh110FEMTxVVB6xNfrZtWu4+BrognvnqX0UcG3Z
9eRpAG1xorP+cjXnrTzrKQWf2YNc4TiNHdjA97ONsDuPeLla6mIAlXa5UYs8gsXc
jC2WC+UFlDrH/ybrWNcCAwEAAaN7MHkwDgYDVR0PAQH/BAQDAgWgMBMGA1UdJQQM
MAoGCCsGAQUFBwMBMAkGA1UdEwQCMAAwJgYDVR0RBB8wHYIDZnVughZjaGFsbGVu
Z2UuYm5pY2hvbHMub3JnMB8GA1UdIwQYMBaAFFa5vX3eAkmkVz9PVkiQHs0qVWYB
MA0GCSqGSIb3DQEBCwUAA4ICAQCVZLpyvkDvm45GWyJ5zeGHrkrd9Dv0g2aqvmAV
Dfr8pIOuy9y9y9UKDGzlNarZAf4/I5s1bsQ2YkF1a3bMQNX16Nxm9GNd8+/syReT
5ieqIzx81LM87B1x6S3CxXEY/1TZbrfhZFHOwRB2U69OXALlG+o7T4en/btD6dZm
0I01yXno3PIIEYw6lFi3Z/Kb8AVS0kdTgsf5G7Dib0e9V5kW4n/V32BMf/W1VB1X
QCale03XFA012OgkWWRhprqTOaS6HhufKgV+WcoUrhpHF3A+S0gj9WoP5djnRQ9k
jlPKByDDu27RaS88JlreOLsb9XC9dF3QIqGpHiqHUj37QskvrDXCDgCXsc+t7ich
OZxaXjqPoGEO9wXx62BttuThruKe1frOlVqawNViAuS8JLcK2YMs3wa4w+rynpoM
sNFNW1rD8LeeZIeT9wASy+DGDJ8pPW188RpdXEY+YAb9/mDZVjSCAgGhgqBw86ov
MuW7s2W2ak7zSGLNnnDGvSSk1QAsiD2Iw066xPT9JlhIRiyOXCr+g/KkPRiKhNXV
kk5zcBA+Ny2CGjfOXV/kgeU3p/lX0A+0T3KhPE6wTbWDPnTp1yCZVsSxxg8yPOur
oVFKVhHf24pUwYyEzeFDUTPXvMw+21lnZUqupG011ZdHgTu8ug3RXwVjKc2bJVxa
xvIW7g==
-----END CERTIFICATE-----
EOD
cat - > key.pem <<EOD
${cfg.requireSecret('key.pem')}
EOD
nohup python3 serv.py &
nohup python3 redir.py &
`;

const server = new aws.ec2.Instance("webserver-www", {
    instanceType: size,
    vpcSecurityGroupIds: [ group.id ], // reference the security group resource above
    ami: ami.id,
    keyName: keyPair.keyName,
    userData: userData
});

export const publicIp = server.publicIp;
export const publicHostName = server.publicDns;

