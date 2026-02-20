import type { Meta, StoryObj } from "@storybook/svelte";
import { makeVoiceReport } from "../stories/factories.js";
import VoiceSeparabilityView from "./VoiceSeparabilityView.svelte";

const meta: Meta<VoiceSeparabilityView> = {
  title: "Components/VoiceSeparabilityView",
  component: VoiceSeparabilityView,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<VoiceSeparabilityView>;

export const NoReport: Story = {
  args: { report: null },
};

export const Separable: Story = {
  args: { report: makeVoiceReport() },
};

export const NotSeparable: Story = {
  args: {
    report: makeVoiceReport({
      characterStats: [
        {
          characterId: "char-alice",
          characterName: "Alice",
          dialogueCount: 20,
          avgSentenceLength: 11.2,
          sentenceLengthVariance: 3.5,
          typeTokenRatio: 0.64,
        },
        {
          characterId: "char-bob",
          characterName: "Bob",
          dialogueCount: 16,
          avgSentenceLength: 12.1,
          sentenceLengthVariance: 3.8,
          typeTokenRatio: 0.62,
        },
      ],
      interCharacterVariance: 0.8,
      separable: false,
      detail:
        "Character voices are too similar. Alice and Bob share similar sentence lengths and vocabulary complexity.",
    }),
  },
};

export const ManyCharacters: Story = {
  args: {
    report: makeVoiceReport({
      characterStats: [
        {
          characterId: "char-alice",
          characterName: "Alice",
          dialogueCount: 24,
          avgSentenceLength: 8.3,
          sentenceLengthVariance: 3.1,
          typeTokenRatio: 0.72,
        },
        {
          characterId: "char-bob",
          characterName: "Bob",
          dialogueCount: 18,
          avgSentenceLength: 14.6,
          sentenceLengthVariance: 5.8,
          typeTokenRatio: 0.58,
        },
        {
          characterId: "char-marcus",
          characterName: "Marcus",
          dialogueCount: 12,
          avgSentenceLength: 18.2,
          sentenceLengthVariance: 2.1,
          typeTokenRatio: 0.81,
        },
        {
          characterId: "char-elena",
          characterName: "Elena",
          dialogueCount: 9,
          avgSentenceLength: 6.4,
          sentenceLengthVariance: 1.9,
          typeTokenRatio: 0.69,
        },
        {
          characterId: "char-detective",
          characterName: "Det. Vasquez",
          dialogueCount: 7,
          avgSentenceLength: 10.8,
          sentenceLengthVariance: 4.5,
          typeTokenRatio: 0.55,
        },
      ],
      interCharacterVariance: 3.84,
      separable: true,
      detail:
        "Strong voice differentiation. Marcus uses long, formal constructions; Alice is clipped and direct; Elena speaks in fragments.",
    }),
  },
};

export const TwoCharacters: Story = {
  args: {
    report: makeVoiceReport({
      characterStats: [
        {
          characterId: "char-alice",
          characterName: "Alice",
          dialogueCount: 30,
          avgSentenceLength: 7.5,
          sentenceLengthVariance: 2.8,
          typeTokenRatio: 0.74,
        },
        {
          characterId: "char-bob",
          characterName: "Bob",
          dialogueCount: 26,
          avgSentenceLength: 16.2,
          sentenceLengthVariance: 6.1,
          typeTokenRatio: 0.52,
        },
      ],
      interCharacterVariance: 4.12,
      separable: true,
      detail: "Clear contrast: Alice's dialogue is terse and punchy; Bob's is meandering and verbose.",
    }),
  },
};
