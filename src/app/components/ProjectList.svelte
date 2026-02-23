<script lang="ts">
import type { Project } from "../../types/index.js";
import { Button, Input, Pane } from "../primitives/index.js";

let {
  projects,
  newTitle = "",
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onTitleChange,
}: {
  projects: Project[];
  newTitle?: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject?: (id: string) => void;
  onTitleChange?: (title: string) => void;
} = $props();
</script>

<div class="project-list">
  <Pane title="Projects">
    {#snippet headerRight()}
      <div class="new-project-row">
        <Input
          placeholder="Project title"
          value={newTitle}
          oninput={(e) => onTitleChange?.((e.target as HTMLInputElement).value)}
          onkeydown={(e) => { if (e.key === "Enter") onCreateProject(); }}
        />
        <Button size="sm" onclick={onCreateProject}>New Project</Button>
      </div>
    {/snippet}

    {#if projects.length === 0}
      <div class="project-empty">
        No projects yet. Create one to get started.
      </div>
    {:else}
      <div class="project-grid">
        {#each projects as project (project.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="project-card" role="button" tabindex="0" onclick={() => onSelectProject(project.id)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProject(project.id); } }}>
            <div class="project-card-title">{project.title}</div>
            <div class="project-card-meta">
              <span class="project-status project-status-{project.status}">{project.status}</span>
              <span class="project-card-date">{new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
            {#if onDeleteProject}
              <button
                class="project-card-delete"
                onclick={(e: MouseEvent) => { e.stopPropagation(); onDeleteProject?.(project.id); }}
                title="Delete project"
              >
                &times;
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Pane>
</div>

<style>
  .project-list { max-width: 800px; margin: 40px auto; padding: 0 16px; }
  .project-empty { color: var(--text-muted); padding: 40px; text-align: center; font-size: 13px; }
  .new-project-row { display: flex; align-items: center; gap: 8px; }
  .project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; padding: 12px; }
  .project-card {
    position: relative; background: var(--bg-primary); border: 1px solid var(--border);
    border-radius: var(--radius-md); padding: 16px; cursor: pointer;
    text-align: left; transition: border-color 0.15s;
    font-family: inherit; font-size: inherit; color: inherit;
  }
  .project-card:hover { border-color: var(--accent); }
  .project-card-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .project-card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-secondary); }
  .project-card-date { color: var(--text-muted); }

  .project-status {
    display: inline-block; padding: 2px 8px; border-radius: 9px;
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .project-status-bootstrap { background: rgba(0, 212, 255, 0.15); color: var(--accent); }
  .project-status-bible { background: rgba(122, 90, 158, 0.2); color: var(--ring2-color); }
  .project-status-planning { background: rgba(95, 158, 160, 0.2); color: var(--info); }
  .project-status-drafting { background: rgba(46, 213, 115, 0.15); color: var(--success); }
  .project-status-revising { background: rgba(255, 165, 2, 0.15); color: var(--warning); }

  .project-card-delete {
    position: absolute; top: 8px; right: 8px; background: none; border: none;
    color: var(--text-muted); font-size: 16px; cursor: pointer; padding: 2px 6px;
    border-radius: var(--radius-sm); font-family: inherit;
  }
  .project-card-delete:hover { color: var(--error, #e85050); background: var(--bg-secondary); }
</style>
