{
  description = "Joshua Noel — personal site (static build)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: nixpkgs.legacyPackages.${system};

      site = system:
        (pkgsFor system).stdenvNoCC.mkDerivation {
          pname = "portfolio";
          version = "1.0.0";

          src = ./.;

          # No compilation needed — this is plain HTML/CSS/JS.
          dontConfigure = true;
          dontBuild = true;

          installPhase = ''
            runHook preInstall

            mkdir -p "$out/dist"
            cp index.html styles.css script.js "$out/dist/"

            runHook postInstall
          '';

          meta = {
            description = "Static personal site for Joshua Noel";
            homepage = "https://github.com/joshua-noel/portfolio";
          };
        };
    in
    {
      packages = forAllSystems (system: rec {
        portfolio = site system;
        default = portfolio;
      });
    };
}
