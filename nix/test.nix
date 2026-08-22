{
  testers,
  writeText,
  module,
}:
let
  # scrypt hash of "test-password", generated with bin/hash-password.mjs.
  # Fixed rather than generated at build time so the test can actually log in.
  adminPasswordHashFile = writeText "portfolio-test-hash" "scrypt$16384$8$1$8Kk6GNg86v64DU9/qLAPvw==$XSSfp+1ysln6DnRWeYwO8KaBFPYyCDuNNpMyLQ/FiINJv/uPgRhE1k33zcC9KA8vZamqpMHUbS4ut2eu3YirCQ==";
in
testers.runNixOSTest {
  name = "portfolio";

  nodes.machine = {
    imports = [ module ];

    services.portfolio = {
      enable = true;
      siteUrl = "http://site.test";
      blogUrl = "http://blog.test";
      inherit adminPasswordHashFile;
    };
  };

  # Covers what `nix build` cannot: that the unit starts under the hardening
  # flags, that the state directory is writable by the service user, that
  # LoadCredential lands where the app looks for it, and that the two
  # hostnames route to different things.
  testScript = ''
    machine.wait_for_unit("portfolio.service")
    machine.wait_for_open_port(4321)

    def curl(args, host="site.test"):
        return machine.succeed(f"curl -sS -H 'Host: {host}' {args}")

    with subtest("serves both hosts"):
        machine.succeed("curl -fsS -H 'Host: site.test' http://127.0.0.1:4321/healthz")
        assert "Joshua Noel" in curl("http://127.0.0.1:4321/")
        assert "Nothing published yet" in curl("http://127.0.0.1:4321/", host="blog.test")

    with subtest("the database landed in the state directory"):
        machine.succeed("test -f /var/lib/portfolio/portfolio.db")
        machine.succeed("test $(stat -c %U /var/lib/portfolio/portfolio.db) = portfolio")

    with subtest("rejects the wrong password"):
        out = machine.succeed(
            "curl -sS -o /dev/null -w '%{redirect_url}' -H 'Host: blog.test' "
            "-H 'Origin: http://blog.test' -d 'username=admin&password=nope' "
            "http://127.0.0.1:4321/api/login"
        )
        assert "failed" in out, out

    with subtest("signs in and publishes a post"):
        machine.succeed(
            "curl -sS -o /dev/null -c /tmp/jar -H 'Host: blog.test' "
            "-H 'Origin: http://blog.test' "
            "-d 'username=admin&password=test-password' "
            "http://127.0.0.1:4321/api/login"
        )

        location = machine.succeed(
            "curl -sS -o /dev/null -w '%{redirect_url}' -b /tmp/jar -H 'Host: blog.test' "
            "-H 'Origin: http://blog.test' -X POST http://127.0.0.1:4321/api/posts"
        )
        post_id = location.rstrip("/").split("/")[-1]

        machine.succeed(
            "curl -fsS -b /tmp/jar -H 'Host: blog.test' -H 'Origin: http://blog.test' "
            "-H 'content-type: application/json' -X PUT "
            """-d '{"title":"From the VM","slug":"","excerpt":"","cover_image":null,"""
            """"status":"published","published_at":"","body_md":"Hello from a test."}' """
            f"http://127.0.0.1:4321/api/posts/{post_id}"
        )

    with subtest("the published post is readable on the blog host"):
        page = curl("http://127.0.0.1:4321/from-the-vm", host="blog.test")
        assert "From the VM" in page
        assert "Hello from a test." in page

    with subtest("and surfaces on the main site"):
        assert "From the VM" in curl("http://127.0.0.1:4321/")

    with subtest("unauthenticated writes are refused"):
        machine.succeed(
            "curl -sS -o /dev/null -w '%{http_code}' -H 'Host: blog.test' "
            "-H 'Origin: http://blog.test' -X POST http://127.0.0.1:4321/api/posts "
            "| grep -q 401"
        )
  '';
}
