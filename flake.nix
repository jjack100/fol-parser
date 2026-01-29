{
  description = "A parser written in TypeScript for first-order logic formulas in LaTeX";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          name = "fol-parser-dev";
          buildInputs = with pkgs; [nodejs_24];

          shellHook = ''
            echo "Entering devShell for FitchToMM (system: ${system})"
          '';
        };
      });
}