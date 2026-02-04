# Git/GitHub Integration Specification

**Date**: 2026-02-04
**Version**: 1.0
**Purpose**: Complete specification for version control and collaboration

---

## Overview

Git/GitHub integration transforms decision-making from scattered documents into a **version-controlled, collaborative workflow**.

**Key Innovation**: Every decision is a commit, every experiment is versioned, every insight is traceable.

---

## File Structure

```
company-decisions/              # GitHub private repo
├── .unheard/
│   ├── config.yaml            # Project settings
│   └── templates/             # Custom templates
│       └── custom-investor-eval.yaml
│
├── context/                   # Company context (versioned)
│   ├── company-profile.yaml
│   ├── customers.csv
│   ├── metrics.yaml
│   ├── pitch-deck.pdf         # Git LFS
│   └── financial-model.xlsx   # Git LFS
│
├── decisions/                 # Decision log (markdown)
│   ├── 2026-02-04-raise-seed-or-bootstrap.md
│   ├── 2026-02-05-pricing-strategy.md
│   ├── 2026-02-10-first-eng-hire.md
│   └── 2026-02-15-investor-outreach.md
│
├── experiments/              # Experiment configs + results
│   ├── exp-001-investor-pitch/
│   │   ├── config.yaml       # Experiment configuration
│   │   ├── personas.yaml     # Generated personas
│   │   ├── results.json      # Full results (Git LFS if >1MB)
│   │   └── summary.md        # Human-readable insights
│   ├── exp-002-pricing-50-vs-100/
│   │   ├── config.yaml
│   │   ├── results.json
│   │   └── summary.md
│   └── ...
│
├── templates/                # Custom template library
│   ├── investor-pitch.yaml
│   ├── pricing-test.yaml
│   └── hiring-decision.yaml
│
├── .gitignore
├── .gitattributes           # Git LFS configuration
└── README.md                # Project overview
```

---

## File Formats

### Decision Log (Markdown)

```markdown
# Raise Seed vs Bootstrap

**Date:** 2026-02-04
**Category:** Investors
**Status:** Exploring
**Decision Deadline:** 2026-03-01

## Context

We're at $50K MRR, growing 15% MoM. Need to decide whether to raise seed round or continue bootstrapping.

## Options Considered

1. **Raise $2M seed** - Hire 3 engineers, scale faster
2. **Bootstrap** - Stay lean, slower growth
3. **Revenue-based financing** - Middle ground

## Experiments Run

- [Investor Pitch Test](../experiments/exp-001-investor-pitch/) - Simulated 10 VC/angel reactions
- [Growth Scenario Model](../experiments/exp-002-growth-scenarios/) - Compared 3 paths

## Key Insights

From exp-001 (Investor Pitch):
- ✅ 7/10 investors positive (strong interest)
- ⚠️ Concern: Market size validation needed
- ✅ Moat: Technical differentiation resonates

From exp-002 (Growth Scenarios):
- Seed: 10x growth in 18 months (high risk)
- Bootstrap: 3x growth in 18 months (sustainable)
- RBF: 5x growth in 18 months (moderate risk)

## Decision

**Going with: Raise $2M seed**

Rationale:
- Strong investor interest (70% positive)
- Market opportunity window is closing
- Team ready to scale
- Can always bootstrap if raise fails

## Next Steps

1. Update pitch deck to address market size
2. Create investor target list
3. Run follow-up experiment: "Pitch with market validation"
4. Start outreach in 2 weeks

## Follow-up Experiments

- [ ] Test pitch V2 with market size data
- [ ] Simulate term sheet negotiations
- [ ] Model dilution scenarios

---

**Tags:** #investors #fundraising #seed
**Collaborators:** @alice, @bob
**Related Decisions:** [Company Strategy 2026](./2026-01-15-company-strategy.md)
```

### Experiment Config (YAML)

```yaml
# exp-001-investor-pitch/config.yaml

id: exp-001
name: "Investor Pitch Test"
template: investor-pitch-evaluation
created_at: 2026-02-04T10:30:00Z
created_by: alice@startup.com

# Template configuration
template_config:
  funding_stage: seed
  funding_target: 2000000
  industry: developer-tools
  current_mrr: 50000
  pitch_summary: |
    We're building Unheard, an AI-powered decision support platform for founders.
    Currently at $50K MRR, 15% MoM growth. Raising $2M seed to scale to $1M ARR.

# Personas used
personas:
  generation: standard
  count: 10
  archetypes:
    - seed_vc_partner: 3
    - angel_investor: 3
    - series_a_vc: 2
    - corporate_vc: 2

# Execution details
execution:
  parallel: true
  provider: modal
  model: qwen2.5:32b
  started_at: 2026-02-04T10:35:00Z
  completed_at: 2026-02-04T10:35:45Z
  duration_seconds: 45

# Context files used
context_files:
  - ../context/company-profile.yaml
  - ../context/pitch-deck.pdf
  - ../context/metrics.yaml

# Results summary
results_summary:
  total_personas: 10
  positive: 7
  neutral: 2
  negative: 1
  investment_interest_rate: 0.70
```

### Experiment Summary (Markdown)

```markdown
# Investor Pitch Test - Results

**Experiment ID:** exp-001
**Template:** Investor Pitch Evaluation
**Date:** 2026-02-04
**Duration:** 45 seconds

## Executive Summary

**70% of investors showed interest** in our pitch. Strong positive signal for seed fundraising.

## Results by Investor Type

| Investor Type     | Count | Positive | Neutral | Negative |
|-------------------|-------|----------|---------|----------|
| Seed VC Partner   | 3     | 3 (100%) | 0       | 0        |
| Angel Investor    | 3     | 2 (67%)  | 1 (33%) | 0        |
| Series A VC       | 2     | 1 (50%)  | 1 (50%) | 0        |
| Corporate VC      | 2     | 1 (50%)  | 0       | 1 (50%)  |

## Key Insights

### Top Concerns (mentioned by 3+ investors)
1. **Market size validation** - Need stronger TAM data
2. **Competition** - How we're different from existing tools
3. **Go-to-market** - Customer acquisition strategy unclear

### Most Positive Feedback
1. **Technical moat** - Proprietary decision simulation resonates
2. **Founder background** - Ex-Google/YC credibility
3. **Early traction** - $50K MRR impressive for stage

### Common Questions
1. "What's your CAC and LTV?"
2. "How do you plan to defend against big tech?"
3. "What's the competitive landscape?"
4. "Who are your first 10 customers?"

## Detailed Responses

### Sarah Chen (Seed VC Partner) - ✅ INVEST
> "Strong team with impressive early traction. The technical moat around decision simulation is defensible. My main concern is market size - need to validate this is a $1B+ opportunity. Would want to see stronger go-to-market strategy before investing."

**Sentiment:** 0.85 (Very Positive)

### Mike Rodriguez (Angel Investor) - ✅ INTERESTED
> "Love the founding team and the problem they're solving. As a former founder, I know how hard decision-making is. The traction is real. Would invest $50K if valuations are reasonable."

**Sentiment:** 0.75 (Positive)

[... 8 more detailed responses ...]

## Recommendations

1. **Update pitch deck** - Add slide on market size with TAM/SAM/SOM
2. **Prepare competitive analysis** - Clear differentiation doc
3. **Build CAC/LTV model** - Have unit economics ready
4. **Target seed VCs first** - Best fit for stage (100% interest)
5. **Follow-up experiment** - Test updated pitch with market validation

## Export

- [Full Results (JSON)](./results.json)
- [Personas Used](./personas.yaml)
- [Configuration](./config.yaml)

---

**Related Decision:** [Raise Seed vs Bootstrap](../../decisions/2026-02-04-raise-seed-or-bootstrap.md)
```

---

## Git Operations (Rust)

### Tauri Commands

```rust
// src-tauri/src/commands/git.rs

use git2::{Repository, Signature, IndexAddOption, Cred, RemoteCallbacks};
use std::path::{Path, PathBuf};
use tauri::command;

#[command]
pub async fn git_init_project(
    app: tauri::AppHandle,
    project_name: String,
    project_path: PathBuf,
) -> Result<String, String> {
    // Initialize Git repo
    let repo = Repository::init(&project_path)
        .map_err(|e| format!("Failed to init repo: {}", e))?;

    // Create .gitignore
    let gitignore = ".DS_Store
node_modules/
*.log
.env
*.tmp
.unheard/cache/
";
    std::fs::write(project_path.join(".gitignore"), gitignore)
        .map_err(|e| e.to_string())?;

    // Create .gitattributes for Git LFS
    let gitattributes = "*.pdf filter=lfs diff=lfs merge=lfs -text
*.xlsx filter=lfs diff=lfs merge=lfs -text
*.json filter=lfs diff=lfs merge=lfs -text
";
    std::fs::write(project_path.join(".gitattributes"), gitattributes)
        .map_err(|e| e.to_string())?;

    // Create README
    let readme = format!("# {} - Decision Log

Managed by [Unheard](https://unheard.app)

## Structure

- `decisions/` - Decision logs (markdown)
- `experiments/` - Experiment configs and results
- `context/` - Company context and data
- `templates/` - Custom templates

## Collaboration

This repo is version-controlled. Every decision and experiment is a commit.

To collaborate:
1. Clone this repo
2. Open in Unheard desktop app
3. Review decisions, add experiments
4. Commit and push changes
", project_name);
    std::fs::write(project_path.join("README.md"), readme)
        .map_err(|e| e.to_string())?;

    // Create directory structure
    std::fs::create_dir_all(project_path.join("decisions"))?;
    std::fs::create_dir_all(project_path.join("experiments"))?;
    std::fs::create_dir_all(project_path.join("context"))?;
    std::fs::create_dir_all(project_path.join("templates"))?;
    std::fs::create_dir_all(project_path.join(".unheard"))?;

    // Initial commit
    let sig = Signature::now("Unheard", "noreply@unheard.app")
        .map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &format!("Initial commit: {} project", project_name),
        &tree,
        &[],
    ).map_err(|e| e.to_string())?;

    Ok(project_path.to_string_lossy().to_string())
}

#[command]
pub async fn git_commit(
    repo_path: PathBuf,
    files: Vec<String>,
    message: String,
) -> Result<String, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repo: {}", e))?;

    // Stage files
    let mut index = repo.index().map_err(|e| e.to_string())?;
    for file in &files {
        index.add_path(Path::new(file)).map_err(|e| e.to_string())?;
    }
    index.write().map_err(|e| e.to_string())?;

    // Create commit
    let sig = Signature::now("Unheard", "noreply@unheard.app")
        .map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;
    let parent_commit = repo.head()?.peel_to_commit()?;

    let commit_id = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&parent_commit],
    ).map_err(|e| e.to_string())?;

    Ok(commit_id.to_string())
}

#[command]
pub async fn git_push(
    repo_path: PathBuf,
    github_token: String,
    remote_url: String,
) -> Result<(), String> {
    let repo = Repository::open(&repo_path)?;

    // Set up remote
    let mut remote = match repo.find_remote("origin") {
        Ok(r) => r,
        Err(_) => repo.remote("origin", &remote_url)?,
    };

    // Set up callbacks for authentication
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &github_token)
    });

    // Push
    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote.push(
        &["refs/heads/main:refs/heads/main"],
        Some(&mut push_options),
    ).map_err(|e| format!("Failed to push: {}", e))?;

    Ok(())
}

#[command]
pub async fn git_pull(
    repo_path: PathBuf,
    github_token: String,
) -> Result<Vec<String>, String> {
    let repo = Repository::open(&repo_path)?;

    // Fetch from remote
    let mut remote = repo.find_remote("origin")?;
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, _username, _allowed| {
        Cred::userpass_plaintext("x-access-token", &github_token)
    });

    let mut fetch_options = git2::FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    remote.fetch(&["main"], Some(&mut fetch_options), None)?;

    // Merge
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

    let analysis = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.0.is_up_to_date() {
        return Ok(vec![]);
    }

    if analysis.0.is_fast_forward() {
        // Fast-forward merge
        let mut reference = repo.find_reference("refs/heads/main")?;
        reference.set_target(fetch_commit.id(), "Fast-forward")?;
        repo.set_head("refs/heads/main")?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        return Ok(vec![]);
    }

    // Merge conflicts - return list of conflicted files
    repo.merge(&[&fetch_commit], None, None)?;
    let conflicts: Vec<String> = repo.index()?
        .conflicts()?
        .filter_map(|c| {
            c.ok().and_then(|conflict| {
                conflict.our.map(|entry| {
                    String::from_utf8_lossy(&entry.path).to_string()
                })
            })
        })
        .collect();

    Ok(conflicts)
}

#[command]
pub async fn git_log(
    repo_path: PathBuf,
    file_path: Option<String>,
    limit: usize,
) -> Result<Vec<GitCommit>, String> {
    let repo = Repository::open(&repo_path)?;
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;

    let mut commits = Vec::new();
    for oid in revwalk.take(limit) {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        // If file_path specified, check if this commit touched that file
        if let Some(ref path) = file_path {
            // ... pathspec filtering logic ...
        }

        commits.push(GitCommit {
            id: commit.id().to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
        });
    }

    Ok(commits)
}

#[derive(serde::Serialize)]
pub struct GitCommit {
    id: String,
    message: String,
    author: String,
    timestamp: i64,
}
```

---

## Auto-Commit Strategy

### Commit Triggers

```typescript
// src/services/git-auto-commit.ts

const COMMIT_TRIGGERS = {
  'decision.create': (data) => `Create decision: ${data.title}`,
  'decision.update': (data) => `Update decision: ${data.title}`,
  'decision.status_change': (data) => `Mark decision as ${data.status}: ${data.title}`,

  'experiment.create': (data) => `Create experiment: ${data.name}`,
  'experiment.complete': (data) => `Complete experiment: ${data.name} (${data.duration}s)`,

  'context.upload': (data) => `Add context: ${data.filename}`,
  'context.update': (data) => `Update context: ${data.filename}`,

  'template.create': (data) => `Create custom template: ${data.name}`,
  'template.update': (data) => `Update template: ${data.name}`,
}

// Batching logic (commit after 5 seconds of inactivity)
class GitAutoCommit {
  private queue: Action[] = []
  private timer: NodeJS.Timeout | null = null

  add(action: Action) {
    this.queue.push(action)
    this.resetTimer()
  }

  private resetTimer() {
    if (this.timer) clearTimeout(this.timer)

    this.timer = setTimeout(() => {
      this.flush()
    }, 5000) // 5 seconds
  }

  private async flush() {
    if (this.queue.length === 0) return

    // Generate commit message
    const message = this.queue.length === 1
      ? COMMIT_TRIGGERS[this.queue[0].type](this.queue[0].data)
      : `Batch update: ${this.queue.map(a => a.type).join(', ')}`

    // Collect files to commit
    const files = this.queue.flatMap(a => a.files)

    // Commit
    await commands.gitCommit(
      useStore.getState().currentProjectPath,
      files,
      message
    )

    // Auto-push if enabled
    if (useStore.getState().autoSync) {
      await commands.gitPush(
        useStore.getState().currentProjectPath,
        await commands.loadGitHubToken(),
        useStore.getState().remoteUrl
      )
    }

    this.queue = []
  }
}

export const gitAutoCommit = new GitAutoCommit()
```

---

## GitHub Integration

### OAuth Flow

```typescript
// src/services/github-auth.ts

export async function connectGitHub() {
  const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

  // Open GitHub OAuth in system browser
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`
  await open(authUrl)

  // Listen for OAuth callback (via deep link)
  const token = await listenForOAuthCallback()

  // Store token securely in OS keychain
  await commands.saveGitHubToken(token)

  return token
}

async function listenForOAuthCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('OAuth timeout'))
    }, 5 * 60 * 1000) // 5 minutes

    // Listen for deep link callback
    listen('oauth-callback', (event) => {
      clearTimeout(timeout)
      const token = event.payload.token
      resolve(token)
    })
  })
}

// Create GitHub repo for project
export async function createGitHubRepo(projectName: string) {
  const token = await commands.loadGitHubToken()

  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `${projectName}-decisions`,
      description: `Decision log for ${projectName} (managed by Unheard)`,
      private: true,
      auto_init: false,
    }),
  })

  const repo = await response.json()
  return repo.clone_url
}
```

---

## Collaboration Workflows

### Workflow 1: Solo Founder

```
1. Create project → Local Git repo initialized
2. Make decisions, run experiments → Auto-committed locally
3. Connect GitHub (optional) → Creates private repo, pushes
4. Share with advisor → Grant read-only access
```

### Workflow 2: Co-Founders

```
Founder A:
1. Create project, make decisions
2. Connect GitHub, push
3. Share repo link with Founder B

Founder B:
1. Clone repo via Unheard app
2. Review decisions, add experiments
3. Commit and push changes

Both:
- Real-time sync via GitHub
- Conflict resolution UI if editing same file
- Comment via GitHub issues
```

### Workflow 3: Team + Advisors

```
Team:
1. All team members clone repo
2. Each makes decisions/experiments
3. Review each other's work
4. Git history shows full context

Advisors:
1. Read-only GitHub access
2. Can view all decisions/experiments
3. Comment via GitHub issues/PRs
4. No Unheard app needed (just GitHub)
```

---

## UI Components

### Git Status Indicator

```tsx
function GitStatus() {
  const status = useGitStatus()

  return (
    <div className="flex items-center gap-2 text-sm">
      {status.uncommittedChanges > 0 && (
        <Badge variant="outline">
          {status.uncommittedChanges} uncommitted
        </Badge>
      )}

      {status.unpushedCommits > 0 && (
        <Badge variant="outline">
          {status.unpushedCommits} unpushed
        </Badge>
      )}

      {status.synced && (
        <Badge variant="success">
          <Check className="w-3 h-3 mr-1" />
          Synced
        </Badge>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => syncNow()}
      >
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  )
}
```

### History Viewer

```tsx
function DecisionHistory({ decisionId }) {
  const commits = useGitLog(`decisions/${decisionId}.md`)

  return (
    <div className="space-y-4">
      <h3>History</h3>
      {commits.map(commit => (
        <div key={commit.id} className="flex items-start gap-3">
          <Avatar>
            <AvatarFallback>{commit.author[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{commit.message}</p>
            <p className="text-sm text-muted-foreground">
              {commit.author} • {formatDate(commit.timestamp)}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => viewDiff(commit.id)}
          >
            View Changes
          </Button>
        </div>
      ))}
    </div>
  )
}
```

---

## Benefits Summary

### For Solo Founders
- ✅ Full decision history
- ✅ Never lose work (Git backup)
- ✅ Export = clone repo
- ✅ Share with advisors easily

### For Teams
- ✅ Real-time collaboration
- ✅ See teammate's decisions
- ✅ Review before finalizing
- ✅ Conflict resolution

### For Advisors/Investors
- ✅ Read-only access
- ✅ Comment via GitHub
- ✅ Track decision quality
- ✅ No special tools needed

---

## Implementation Checklist

### Week 1: Local Git
- [ ] Git2 Rust integration
- [ ] Init, commit, log commands
- [ ] Auto-commit on actions
- [ ] History view UI

### Week 2: GitHub OAuth
- [ ] OAuth flow (deep link)
- [ ] Token storage (keychain)
- [ ] Create repo API
- [ ] Push/pull commands

### Week 3: Collaboration
- [ ] Clone existing projects
- [ ] Conflict resolution UI
- [ ] Team member management
- [ ] Real-time status

### Week 4: Polish
- [ ] Scenario branching
- [ ] Comparison views
- [ ] Export reports
- [ ] GitHub issues integration

---

**Next**: See `vertical-slice-implementation.md` for week-by-week implementation plan.
