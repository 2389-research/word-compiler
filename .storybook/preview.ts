import type { Preview } from "@storybook/svelte";
import "../src/app/styles/index.css";

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: {
      values: [
        { name: "Dark surface", value: "#1a1a2e" },
        { name: "Light surface", value: "#f5f5f5" },
      ],
    },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Toggle dark/light theme",
      defaultValue: "dark",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "dark", icon: "moon", title: "Dark" },
          { value: "light", icon: "sun", title: "Light" },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story: any, context: any) => {
      const theme = context.globals.theme || "dark";
      document.documentElement.setAttribute("data-theme", theme);
      return story();
    },
  ],
};

export default preview;
