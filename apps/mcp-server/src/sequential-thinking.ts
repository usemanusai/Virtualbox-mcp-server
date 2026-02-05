import { logger } from "@virtualbox-mcp/shared-utils";

export interface ThoughtData {
    thought: string;
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
    isRevision?: boolean;
    revisesThought?: number;
    branchFromThought?: number;
    branchId?: string;
    needsMoreThoughts?: boolean;
}

export class SequentialThinkingManager {
    private thoughtHistory: ThoughtData[] = [];

    constructor() { }

    public processThought(thought: ThoughtData): { content: { type: "text"; text: string }[] } {
        // Validate basic integrity
        if (thought.thoughtNumber < 1) {
            throw new Error("thought_number must be >= 1");
        }

        // Store thought in history
        // In a real stateless MCP server, this might reset per request if not persisted,
        // but keeping it in memory allows for some continuity if the server stays alive.
        this.thoughtHistory.push(thought);

        logger.info(`[SequentialThinking] Thought ${thought.thoughtNumber}/${thought.totalThoughts}: ${thought.thought.substring(0, 50)}...`);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: "thought_recorded",
                    thought_number: thought.thoughtNumber,
                    total_thoughts: thought.totalThoughts,
                    history_size: this.thoughtHistory.length
                }, null, 2)
            }]
        };
    }

    public getHistory(): ThoughtData[] {
        return this.thoughtHistory;
    }

    public clearHistory(): void {
        this.thoughtHistory = [];
    }
}
