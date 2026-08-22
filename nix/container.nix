{
  dockerTools,
  portfolio,
}:
# The escape hatch if this ever leaves NixOS. Built for x86_64-linux only
# (see flake.nix) because nothing runs it today.
dockerTools.buildLayeredImage {
  name = "ghcr.io/joshua-noel/portfolio";
  tag = portfolio.version;

  contents = [
    portfolio
    dockerTools.caCertificates
  ];

  enableFakechroot = true;
  fakeRootCommands = ''
    mkdir -p /var/lib/portfolio
    chown -R 1000:1000 /var/lib/portfolio
  '';

  config = {
    Entrypoint = [ "${portfolio}/bin/portfolio" ];
    User = "1000:1000";
    WorkingDir = "/var/lib/portfolio";
    ExposedPorts."4321/tcp" = { };
    Volumes."/var/lib/portfolio" = { };
    Env = [
      # Reachable from outside the container, unlike the NixOS default.
      "PORTFOLIO_HOST=0.0.0.0"
      "PORTFOLIO_STATE_DIR=/var/lib/portfolio"
      # Same reason as the NixOS module: V8 sizes its heap against the host,
      # not the container's limit, and grows past it. Override alongside the
      # orchestrator's own memory limit.
      "NODE_OPTIONS=--max-old-space-size=384"
    ];
  };
}
