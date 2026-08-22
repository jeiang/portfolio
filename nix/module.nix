{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.portfolio;
in
{
  options.services.portfolio = {
    enable = lib.mkEnableOption "the personal site and blog";

    package = lib.mkPackageOption pkgs "portfolio" { };

    user = lib.mkOption {
      type = lib.types.str;
      default = "portfolio";
      description = ''
        System user the service runs as.

        A static user rather than `DynamicUser`, because `stateDir` is
        expected to be a mounted volume on some deployments and a runtime-
        allocated UID cannot own a path that was created before it existed.
      '';
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "portfolio";
      description = "System group the service runs as.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Address to bind. Expected to sit behind a reverse proxy.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 4321;
      description = "Port to bind.";
    };

    stateDir = lib.mkOption {
      type = lib.types.path;
      default = "/var/lib/portfolio";
      description = "Directory holding the SQLite database and uploaded images.";
    };

    siteUrl = lib.mkOption {
      type = lib.types.str;
      example = "https://noelejoshua.com";
      description = "Origin of the main site. Used for canonical URLs.";
    };

    blogUrl = lib.mkOption {
      type = lib.types.str;
      example = "https://blog.noelejoshua.com";
      description = ''
        Origin of the blog. Requests arriving with this Host are served from
        the blog route tree, and every post's canonical URL lives here.
      '';
    };

    adminUsername = lib.mkOption {
      type = lib.types.str;
      default = "admin";
      description = "Username for the single admin account.";
    };

    adminPasswordHashFile = lib.mkOption {
      type = lib.types.path;
      example = lib.literalExpression "config.sops.secrets.blog-admin.path";
      description = ''
        File containing the scrypt hash produced by
        `portfolio-hash-password`.

        Passed through systemd's `LoadCredential`, so the file is read as
        root before privileges drop and never needs to be readable by
        {option}`services.portfolio.user`.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = ''
        Optional `EnvironmentFile`, for deployments that would rather supply
        settings through a sops template than through this module's options.
      '';
    };

    memoryMaxMB = lib.mkOption {
      type = lib.types.ints.positive;
      default = 768;
      description = ''
        Memory ceiling for the unit, in MiB. V8's heap is capped at half of
        it.

        Measured at 50 concurrent requests: an uncapped heap peaked around
        820 MiB, which this limit would kill. A 384 MiB heap peaked around
        475 MiB and cost about 2% throughput; 192 MiB peaked around 390 MiB
        but cost 14-26%.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.siteUrl != cfg.blogUrl;
        message = "services.portfolio: siteUrl and blogUrl must differ, or the blog host cannot be distinguished from the main site.";
      }
    ];

    users.users.${cfg.user} = {
      isSystemUser = true;
      inherit (cfg) group;
      home = cfg.stateDir;
    };

    users.groups.${cfg.group} = { };

    # Not StateDirectory=: that hardcodes /var/lib/<name>, and stateDir is
    # configurable so it can live on a mounted volume.
    systemd.tmpfiles.settings."10-portfolio".${cfg.stateDir}.d = {
      inherit (cfg) user group;
      mode = "0750";
    };

    systemd.services.portfolio = {
      description = "Personal site and blog";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        PORTFOLIO_HOST = cfg.host;
        PORTFOLIO_PORT = toString cfg.port;
        PORTFOLIO_STATE_DIR = cfg.stateDir;
        PORTFOLIO_SITE_URL = cfg.siteUrl;
        PORTFOLIO_BLOG_URL = cfg.blogUrl;
        PORTFOLIO_ADMIN_USERNAME = cfg.adminUsername;
        # %d is the credentials directory systemd populates from
        # LoadCredential below.
        PORTFOLIO_ADMIN_PASSWORD_HASH_FILE = "%d/admin-password-hash";
        NODE_ENV = "production";

        # V8 sizes its heap against total system memory, not the cgroup it
        # is in, so on a large host it grows straight past MemoryMax and
        # gets the service OOM-killed. Half the ceiling leaves room for the
        # ~120 MiB baseline and off-heap buffers.
        NODE_OPTIONS = "--max-old-space-size=${toString (cfg.memoryMaxMB / 2)}";
      };

      serviceConfig = {
        ExecStart = lib.getExe cfg.package;
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.stateDir;
        Restart = "on-failure";
        RestartSec = 5;

        LoadCredential = [ "admin-password-hash:${cfg.adminPasswordHashFile}" ];
        EnvironmentFile = lib.optional (cfg.environmentFile != null) cfg.environmentFile;

        ReadWritePaths = [ cfg.stateDir ];

        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ProtectProc = "invisible";
        ProtectClock = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        ProtectControlGroups = true;
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
          # libuv enumerates interfaces over netlink at startup. Without
          # this the service still works, but logs an EAFNOSUPPORT error on
          # every boot -- and a journal that cries wolf gets ignored.
          "AF_NETLINK"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        LockPersonality = true;
        SystemCallArchitectures = "native";
        SystemCallFilter = [
          "@system-service"
          "~@privileged"
        ];
        UMask = "0077";

        # V8 needs writable-executable pages for its JIT. Turning this on
        # stops the service from starting at all.
        MemoryDenyWriteExecute = false;

        MemoryMax = "${toString cfg.memoryMaxMB}M";
      };
    };
  };
}
