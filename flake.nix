{
  description = "Joshua Noel — personal site and blog";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;

      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: lib.genAttrs supportedSystems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (
        pkgs:
        {
          portfolio = pkgs.callPackage ./nix/package.nix { };
          default = self.packages.${pkgs.stdenv.hostPlatform.system}.portfolio;
        }
        # The image is the escape hatch if this ever leaves NixOS, so it is
        # built only for the one architecture anything would plausibly run on.
        // lib.optionalAttrs (pkgs.stdenv.hostPlatform.system == "x86_64-linux") {
          container = pkgs.callPackage ./nix/container.nix {
            portfolio = self.packages.${pkgs.stdenv.hostPlatform.system}.portfolio;
          };
        }
      );

      overlays.default = final: _prev: {
        portfolio = final.callPackage ./nix/package.nix { };
      };

      # Wrapped so the module's `package` default comes from this flake:
      # importing it does not require also applying the overlay.
      nixosModules.default =
        { pkgs, ... }:
        {
          imports = [ ./nix/module.nix ];
          services.portfolio.package =
            lib.mkDefault
              self.packages.${pkgs.stdenv.hostPlatform.system}.portfolio;
        };

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_24
            # Pinned here so the lockfile this writes is the lockfile
            # nix/package.nix consumes -- a host pnpm on a different major
            # rewrites the lockfile format and breaks `nix build` only.
            pkgs.pnpm_10
            pkgs.just
            pkgs.sqlite
          ];
        };
      });

      checks = forAllSystems (
        pkgs:
        let
          system = pkgs.stdenv.hostPlatform.system;
        in
        {
          package = self.packages.${system}.portfolio;

          lint =
            pkgs.runCommand "lint"
              {
                nativeBuildInputs = with pkgs; [
                  statix
                  deadnix
                ];
              }
              ''
                cd ${
                  lib.fileset.toSource {
                    root = ./.;
                    fileset = lib.fileset.fileFilter (f: f.hasExt "nix") ./.;
                  }
                }
                statix check .
                deadnix --fail .
                touch $out
              '';
        }
        # nixosTest needs a VM, so it exists only where one can boot.
        // lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
          module = pkgs.callPackage ./nix/test.nix { module = self.nixosModules.default; };
        }
      );

      formatter = forAllSystems (pkgs: pkgs.nixfmt-tree);
    };
}
