import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [
      "playwright-report/**",
      "test-results/**",
      "lib/mock/data/**",
      "docs/screenshots/**",
    ],
  },
];

export default config;
