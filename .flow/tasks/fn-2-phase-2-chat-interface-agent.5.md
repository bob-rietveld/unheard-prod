# fn-2-phase-2-chat-interface-agent.5 Template configuration wizard UI

## Description

Build configuration wizard UI that guides users through template questions with validation.

**Size:** M
**Files:**

- `src/components/chat/ConfigWizard.tsx` (new)
- `src/components/chat/ConfigQuestion.tsx` (new)
- `src/lib/config-validator.ts` (new)
- `src/components/chat/ConfigWizard.test.tsx` (new)

## Approach

**Wizard Flow**:

1. Agent suggests template → User confirms
2. Wizard fetches template YAML → parses questions
3. Display question 1 → User answers → Validate
4. Display question 2 → ... → All answered
5. Generate config object → Update useChatStore.configAnswers

**Question Types** (from template spec):

- `text`: Free-form input (with optional regex validation)
- `select`: Dropdown or radio buttons
- `multiselect`: Checkboxes
- `number`: Numeric input with min/max
- `boolean`: Yes/No toggle

**Validation Pattern**:

- Client-side validation before proceeding
- Show error message inline (below input)
- Disable "Next" button until valid
- Agent can ask clarifying questions if answer is ambiguous

**State Management**:

- Use `useChatStore.configAnswers` to persist answers
- Use `useChatStore.currentTemplateId` to track active template

## Key Context

**YAML Question Format** (from template spec):

```yaml
configuration_flow:
  - id: stage
    type: select
    question: 'What funding stage are you at?'
    options: ['Seed', 'Series A', 'Series B']
    required: true

  - id: amount
    type: text
    question: 'How much are you raising?'
    validation:
      pattern: "^\\$[0-9]+(M|K)$"
      message: 'Enter amount like $2M or $500K'
    required: true
```

**Conditional Questions** (future, not MVP):

- Questions can have `depends_on` field
- Skip if dependency not met
- Not implemented in Phase 2 (all questions linear)

## References

- Template spec: `.claude/plans/template-system-spec.md:200-350`
- State: `src/store/chat-store.ts` (Task 1)
- UI: `src/components/chat/ChatInterface.tsx` (Task 3)
- Templates: `src/services/templates.ts` (Task 4)

## Acceptance

- [ ] ConfigWizard component displays current question
- [ ] Wizard fetches template from Convex by ID
- [ ] YAML parser extracts configuration_flow array
- [ ] Question types rendered correctly: text (input), select (dropdown), number (input type=number), boolean (toggle)
- [ ] Validation runs on answer change (not on submit)
- [ ] Error messages shown inline below input
- [ ] "Next" button disabled when invalid or empty (if required)
- [ ] "Back" button not implemented (out of Phase 2 scope - note in open questions)
- [ ] Progress indicator: "Question X of Y"
- [ ] All questions answered → "Review Answers" summary screen
- [ ] Summary shows all answers with "Edit" links (opens question, not implemented - Phase 5)
- [ ] "Confirm" button generates config object and stores in useChatStore
- [ ] ConfigQuestion component handles each question type
- [ ] Validator functions: validateText, validateSelect, validateNumber
- [ ] Unit tests: Question rendering, validation logic, flow progression
- [ ] Test: Required text question blocks next until filled
- [ ] Test: Regex pattern validates correctly
- [ ] Test: All answered triggers completion
- [ ] ast-grep passes
- [ ] Documentation: Update `docs/developer/ui-patterns.md` with wizard pattern

## Done summary
Implemented template configuration wizard UI with sequential question flow, type-specific validation, and summary review. Includes comprehensive unit tests for validator and YAML parser.
## Evidence
- Commits: 4ea0c265a8bbb85c6e62c657f0ba5456a23e92fc
- Tests: npm run test -- src/lib/config-validator.test.ts src/lib/template-parser.test.ts src/components/chat/ConfigWizard.test.tsx --run, npm run ast:lint
- PRs: