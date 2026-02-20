import type { Meta, StoryObj } from "@storybook/svelte";
import { fn } from "storybook/test";
import { makeNarrativeIR } from "../stories/factories.js";
import IRInspector from "./IRInspector.svelte";

const meta: Meta<IRInspector> = {
  title: "Components/IRInspector",
  component: IRInspector,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Inspector panel for Narrative IR (intermediate representation) — shows events, facts, character deltas, setups/payoffs, and unresolved tensions extracted from a scene.",
      },
    },
  },
  args: {
    sceneTitle: "The Confrontation",
    isExtracting: false,
    canExtract: true,
    onExtract: fn(),
    onVerify: fn(),
    onUpdate: fn(),
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<IRInspector>;

export const NoIR: Story = {
  args: { ir: null },
};

export const Extracting: Story = {
  args: { ir: null, isExtracting: true },
};

export const UnverifiedIR: Story = {
  args: { ir: makeNarrativeIR() },
};

export const VerifiedIR: Story = {
  args: {
    ir: makeNarrativeIR({
      events: ["The meeting concluded"],
      factsRevealedToReader: ["The deal was signed"],
      factsIntroduced: [],
      factsWithheld: [],
      characterDeltas: [],
      unresolvedTensions: [],
      verified: true,
    }),
    canExtract: false,
  },
};

export const CannotExtract: Story = {
  args: { ir: null, canExtract: false },
};

export const RichIR: Story = {
  args: {
    ir: makeNarrativeIR({
      events: [
        "Alice entered the study and locked the door",
        "She found the letter in the hidden drawer",
        "Bob appeared at the window unexpectedly",
        "Alice confronted Bob about the letter",
        "Bob revealed he knew about Marcus all along",
      ],
      factsIntroduced: [
        "The letter was written by Marcus three weeks prior",
        "The hidden drawer had been installed recently",
      ],
      factsRevealedToReader: [
        "The letter contains evidence of fraud",
        "Alice knew about the affair before the letter",
        "Bob's alibi for Tuesday was fabricated",
      ],
      factsWithheld: ["Marcus is actually Alice's half-brother", "The fraud connects to the mayor's office"],
      characterDeltas: [
        {
          characterId: "char-alice",
          learned: "Bob has been lying about his alibi",
          suspicionGained: "Marcus may be protecting someone higher up",
          emotionalShift: "Controlled calm → cold fury",
          relationshipChange: "Trust in Bob shattered",
        },
        {
          characterId: "char-bob",
          learned: "Alice already knew about Marcus",
          suspicionGained: null,
          emotionalShift: "Confident → panicked",
          relationshipChange: "Realizes Alice has been investigating him",
        },
      ],
      setupsPlanted: ["The hidden drawer has a false bottom"],
      payoffsExecuted: ["The mysterious phone call from Ch.1 was from Marcus"],
      characterPositions: {
        "char-alice": "In the study, behind the desk",
        "char-bob": "At the window, then inside the study",
      },
      unresolvedTensions: [
        "Who installed the hidden drawer?",
        "What does Marcus know about the mayor?",
        "Will Bob try to destroy the letter?",
      ],
    }),
  },
};

export const WithSetupPayoff: Story = {
  args: {
    ir: makeNarrativeIR({
      setupsPlanted: [
        "The garden shed key is missing from the hook",
        "Alice noticed fresh tire tracks in the driveway",
        "The grandfather clock stopped at 3:17",
      ],
      payoffsExecuted: [
        "The mysterious phone call from scene 1 was from Marcus",
        "The stain on Bob's sleeve matches the study ink",
      ],
    }),
  },
};
