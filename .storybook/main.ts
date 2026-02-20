import type { StorybookConfig } from "@storybook/svelte-vite";

const config: StorybookConfig = {
  stories: [
    "../src/app/components/**/*.stories.ts",
    "../src/app/primitives/**/*.stories.ts",
  ],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/svelte-vite",
};

export default config;
