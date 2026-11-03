import { useState, type FormEvent } from "react";
import {
  BASE,
  categories,
  newDraft,
  validateDraft,
  rewardOf,
  publishDraft,
  lines,
  type Draft,
  type Errors,
} from "./model";
import { useApp, Link } from "./state";
import { Heading, Field, OrganizerTag, LocaleSummary } from "./components";
import { languages, countries, countryFlag } from "./locales";
import { Icon, Coin, Illustration } from "./visuals";
import { CoverPicker } from "./cover-picker";
import { resolveCover } from "./covers";
import { formatDate, zec } from "./data";
import { Dialog } from "./frame";
import { BETA_PREVIEW } from "./beta";
import { BetaNote } from "./components";
const steps = ["Basics", "Brief", "Reward & timing", "Review"];
export function Editor() {
  const a = useApp(),
    id = a.params.get("draft");
  const found = a.drafts.find((d) => d.id === id);
  const campaign = a.campaigns.find(
    (c) =>
      c.id === a.params.get("campaign") &&
      (BETA_PREVIEW || c.owner === a.profile?.id),
  );
  const [d, setD] = useState<Draft>(
    () =>
      found ||
      newDraft({
        organizer:
          campaign?.organizer ||
          (a.managed.includes(a.params.get("organizer") || "")
            ? a.params.get("organizer")!
            : "personal"),
        campaign: campaign?.id || "",
      }),
  );
  const [errors, setErrors] = useState<Errors>({}),
    [reviewed, setReviewed] = useState(false),
    [communityOpen, setCommunityOpen] = useState(false);
  const [groupName, setGroupName] = useState(""),
    [groupAbout, setGroupAbout] = useState("");
  const step = d.step,
    allowedCampaigns = a.campaigns.filter(
      (c) =>
        (BETA_PREVIEW || c.owner === a.profile?.id) &&
        c.organizer === d.organizer,
    );
  function update(values: Partial<Draft>) {
    const next = { ...d, ...values };
    setD(next);
    a.saveDraft(next);
    if (!BETA_PREVIEW && !a.params.get("draft"))
      a.go(BASE + "/new?draft=" + next.id, true);
    setReviewed(false);
    setErrors({});
  }
  function move(next: number) {
    if (BETA_PREVIEW && next > 0) return;
    if (next > step) {
      const e = validateDraft(d, step, a.managed, a.campaigns);
      if (Object.keys(e).length) {
        setErrors(e);
        return;
      }
    }
    update({ step: next });
    window.scrollTo({ top: 0 });
  }
  function publish() {
    if (BETA_PREVIEW) return;
    for (let i = 0; i < 3; i++) {
      const e = validateDraft(d, i, a.managed, a.campaigns);
      if (Object.keys(e).length) {
        setD({ ...d, step: i });
        setErrors(e);
        return;
      }
    }
    if (!a.profile) {
      a.setAuthOpen(true);
      return;
    }
    if (!reviewed) {
      setErrors({
        review: "Confirm the brief and pledged reward before publishing.",
      });
      return;
    }
    a.finishDraft(d, publishDraft(d, a.profile.id));
  }
  function addCommunity(e: FormEvent) {
    e.preventDefault();
    if (BETA_PREVIEW) return;
    if (!a.profile) {
      a.setAuthOpen(true);
      return;
    }
    const group = {
      id: crypto.randomUUID(),
      name: groupName.trim(),
      mark: groupName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase(),
      color: "gold",
      description: groupAbout.trim(),
      owner: a.profile.id,
    };
    a.setLocalOrganizers((v) => [...v, group]);
    update({ organizer: group.id, campaign: "" });
    setCommunityOpen(false);
  }
  return (
    <div className="editor-wrap">
      <Link to={BASE + "?tab=activity&view=publishing"} className="op-back">
        <Icon name="left" size={16} />
        My work
      </Link>
      <Heading
        title="Create an opportunity"
        description={
          BETA_PREVIEW
            ? "Try the setup and choose a cover."
            : "Set the work, reward and review criteria."
        }
      />
      {BETA_PREVIEW && (
        <BetaNote>
          Explore the setup and cover library. The next steps open after beta.
        </BetaNote>
      )}
      <ol className="wizard-steps" aria-label="Creation progress">
        {steps.map((s, i) => (
          <li key={s} data-active={step === i} data-done={i < step}>
            <button
              onClick={() => move(i)}
              disabled={BETA_PREVIEW ? i > 0 : i > step}
              aria-current={step === i ? "step" : undefined}
            >
              <span>{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="editor-layout">
        <div className="editor-panel">
          <div className="editor-panel-title">
            <span>Step {step + 1} of 4</span>
            <h2>{steps[step]}</h2>
          </div>
          {step === 0 && (
            <div className="form-stack">
              <fieldset className="format-field">
                <legend>Opportunity format</legend>
                <div className="format-options">
                  {(["Task", "Contest"] as const).map((type) => (
                    <label
                      key={type}
                      className={d.type === type ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="format"
                        checked={d.type === type}
                        onChange={() => update({ type })}
                      />
                      <Icon
                        name={type === "Task" ? "briefcase" : "trophy"}
                        size={21}
                      />
                      <strong>{type}</strong>
                      <p>
                        {type === "Task"
                          ? "Select one contributor before work begins."
                          : "Receive entries and choose the winners."}
                      </p>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Title" error={errors.title}>
                <input
                  value={d.title}
                  maxLength={100}
                  placeholder="What should someone create?"
                  onChange={(e) => update({ title: e.target.value })}
                />
              </Field>
              <div className="form-pair">
                <Field label="Organizer" error={errors.organizer}>
                  <select
                    value={d.organizer}
                    onChange={(e) =>
                      update({ organizer: e.target.value, campaign: "" })
                    }
                  >
                    {a.organizers
                      .filter((o) => a.managed.includes(o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.id === "personal" ? "My profile" : o.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={d.category}
                    onChange={(e) => update({ category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                className="op-text align-start"
                disabled={BETA_PREVIEW}
                title={
                  BETA_PREVIEW ? "Community creation is coming soon" : undefined
                }
                onClick={() => {
                  if (BETA_PREVIEW) return;
                  if (!a.profile) a.setAuthOpen(true);
                  else setCommunityOpen(true);
                }}
              >
                <Icon name="plus" size={15} />
                Create a community
              </button>
              <div className="form-pair">
                <Field
                  label="Language"
                  error={errors.language}
                  hint="Language for the work."
                >
                  <select
                    value={d.language}
                    onChange={(e) => update({ language: e.target.value })}
                  >
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Country"
                  error={errors.country}
                  hint="Choose Global for worldwide participation."
                >
                  <select
                    value={d.country}
                    onChange={(e) => update({ country: e.target.value })}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {countryFlag(c.code)} {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <CoverPicker
                value={d.art}
                category={d.category}
                title={d.title}
                onChange={(art) => update({ art })}
              />
              <Field
                label="Campaign (optional)"
                error={errors.campaign}
                hint={
                  BETA_PREVIEW
                    ? "Preview how opportunities fit into a campaign."
                    : "Publish independently, or group this work under your campaign."
                }
              >
                <select
                  value={d.campaign}
                  onChange={(e) => update({ campaign: e.target.value })}
                >
                  <option value="">No campaign</option>
                  {allowedCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="form-stack">
              <Field label="Brief" error={errors.description}>
                <textarea
                  rows={5}
                  value={d.description}
                  placeholder="Describe the goal, audience and scope."
                  onChange={(e) => update({ description: e.target.value })}
                />
              </Field>
              <Field
                label="Deliverables"
                error={errors.deliverables}
                hint="One item per line."
              >
                <textarea
                  rows={4}
                  value={d.deliverables}
                  placeholder={
                    "A working prototype\nSource files and setup instructions"
                  }
                  onChange={(e) => update({ deliverables: e.target.value })}
                />
              </Field>
              <Field
                label="Acceptance criteria"
                error={errors.criteria}
                hint="The organizer will review the work against these criteria."
              >
                <textarea
                  rows={4}
                  value={d.criteria}
                  placeholder={
                    "The core flow works on mobile\nInstructions are clear and reproducible"
                  }
                  onChange={(e) => update({ criteria: e.target.value })}
                />
              </Field>
            </div>
          )}
          {step === 2 && (
            <div className="form-stack">
              {d.type === "Task" ? (
                <Field label="Fixed reward (ZEC)" error={errors.reward}>
                  <input
                    inputMode="decimal"
                    type="number"
                    min=".00000001"
                    step="any"
                    value={d.reward}
                    placeholder="0.00"
                    onChange={(e) => update({ reward: e.target.value })}
                  />
                </Field>
              ) : (
                <fieldset className="prize-fields">
                  <legend>Prizes in ZEC</legend>
                  {d.prizes.map((value, i) => (
                    <div className="prize-row" key={i}>
                      <Field label={"Place " + (i + 1)}>
                        <input
                          type="number"
                          inputMode="decimal"
                          min=".00000001"
                          step="any"
                          value={value}
                          placeholder="0.00"
                          onChange={(e) =>
                            update({
                              prizes: d.prizes.map((n, j) =>
                                j === i ? e.target.value : n,
                              ),
                            })
                          }
                        />
                      </Field>
                      {d.prizes.length > 1 && (
                        <button
                          className="rd-icon-button"
                          aria-label={"Remove prize " + (i + 1)}
                          onClick={() =>
                            update({
                              prizes: d.prizes.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Icon name="close" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {errors.reward && (
                    <small className="field-error" role="alert">
                      {errors.reward}
                    </small>
                  )}
                  <div className="prize-total">
                    <button
                      className="op-text"
                      onClick={() => update({ prizes: [...d.prizes, ""] })}
                      disabled={d.prizes.length >= 5}
                    >
                      <Icon name="plus" size={15} />
                      Add prize
                    </button>
                    <strong>Total: {zec(rewardOf(d) || 0)} ZEC</strong>
                  </div>
                </fieldset>
              )}
              <div className="op-notice compact">
                <Icon name="info" size={17} />
                <p>
                  Rewards are pledged by the organizer. This preview does not
                  hold or verify funds.
                </p>
              </div>
              <Field
                label={
                  d.type === "Task"
                    ? "Application deadline"
                    : "Submission deadline"
                }
                error={errors.deadline}
                hint="Closes at 23:59 UTC."
              >
                <input
                  type="date"
                  defaultValue={d.deadline}
                  onInput={(e) => {
                    if (e.currentTarget.value)
                      update({ deadline: e.currentTarget.value });
                  }}
                  onBlur={(e) => update({ deadline: e.currentTarget.value })}
                />
              </Field>
              <div className="form-pair">
                <Field
                  label="Review window (days)"
                  error={errors.reviewDays}
                  hint={
                    d.type === "Task"
                      ? "To choose a contributor after applications close."
                      : "To announce winners after submissions close."
                  }
                >
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={d.reviewDays}
                    onChange={(e) => update({ reviewDays: e.target.value })}
                  />
                </Field>
                {d.type === "Task" && (
                  <Field
                    label="Delivery window (days)"
                    error={errors.deliveryDays}
                    hint="Starts when the selected contributor accepts."
                  >
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={d.deliveryDays}
                      onChange={(e) => update({ deliveryDays: e.target.value })}
                    />
                  </Field>
                )}
              </div>
              <div className="review-owner">
                <Icon name="users" size={18} />
                <p>
                  <strong>{a.organizerFor(d.organizer).name}</strong> reviews
                  the work.{" "}
                  {d.type === "Task"
                    ? "Deliveries are reviewed within " +
                      d.reviewDays +
                      " days."
                    : "Prizes follow the criteria in the brief."}
                </p>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="review-sheet">
              <div className="review-cover">
                <Illustration kind={resolveCover(d.art, d.category, d.title)} />
              </div>
              <div className="review-section">
                <div className="review-title">
                  <span className="op-label">Opportunity</span>
                  <button className="op-text" onClick={() => move(0)}>
                    Edit
                  </button>
                </div>
                <h3>{d.title}</h3>
                <OrganizerTag id={d.organizer} />
                <div className="op-tags">
                  <span>{d.type}</span>
                  <span>{d.category}</span>
                  {d.campaign && (
                    <span>
                      {a.campaigns.find((c) => c.id === d.campaign)?.title}
                    </span>
                  )}
                </div>
                <LocaleSummary language={d.language} country={d.country} />
              </div>
              <div className="review-section">
                <div className="review-title">
                  <h3>Brief &amp; deliverables</h3>
                  <button className="op-text" onClick={() => move(1)}>
                    Edit brief
                  </button>
                </div>
                <p className="preserve-lines">{d.description}</p>
                <ul>
                  {lines(d.deliverables).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <h4>Acceptance criteria</h4>
                <ul>
                  {lines(d.criteria).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="review-section">
                <div className="review-title">
                  <h3>Reward &amp; timing</h3>
                  <button className="op-text" onClick={() => move(2)}>
                    Edit reward
                  </button>
                </div>
                <div className="review-reward">
                  <Coin />
                  {zec(rewardOf(d))} ZEC <span>Pledged</span>
                </div>
                {d.type === "Contest" && (
                  <ol>
                    {d.prizes.map((p, i) => (
                      <li key={i}>
                        Place {i + 1}: {zec(Number(p))} ZEC
                      </li>
                    ))}
                  </ol>
                )}
                <dl className="op-definition">
                  <div>
                    <dt>{d.type === "Task" ? "Apply by" : "Submit by"}</dt>
                    <dd>
                      {formatDate(d.deadline)}, {d.deadline.slice(0, 4)} · 23:59
                      UTC
                    </dd>
                  </div>
                  <div>
                    <dt>Review window</dt>
                    <dd>{d.reviewDays} days</dd>
                  </div>
                  {d.type === "Task" && (
                    <div>
                      <dt>Delivery</dt>
                      <dd>{d.deliveryDays} days after assignment</dd>
                    </div>
                  )}
                </dl>
              </div>
              <label className="op-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => {
                    setReviewed(e.target.checked);
                    setErrors({});
                  }}
                />
                <span>
                  I have reviewed the brief, criteria and pledged reward.
                </span>
              </label>
              {errors.review && (
                <p className="field-error" role="alert">
                  {errors.review}
                </p>
              )}
              <p className="review-preview">
                Publishing here adds an example to this browser only.
              </p>
            </div>
          )}
          <div className="wizard-actions">
            <button
              className="op-button"
              onClick={() => {
                if (BETA_PREVIEW) {
                  a.go(BASE);
                  return;
                }
                a.saveDraft(d);
                a.setToast("Draft saved.");
                a.go(BASE + "?tab=activity&view=publishing");
              }}
            >
              {BETA_PREVIEW ? "Back to opportunities" : "Save & exit"}
            </button>
            <div>
              {step > 0 && (
                <button className="op-button" onClick={() => move(step - 1)}>
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  className="op-button primary"
                  disabled={BETA_PREVIEW}
                  onClick={() => move(step + 1)}
                >
                  {BETA_PREVIEW ? "Continue · soon" : "Continue"}{" "}
                  <Icon name={BETA_PREVIEW ? "lock" : "arrow"} size={16} />
                </button>
              ) : (
                <button
                  className="op-button primary"
                  disabled={BETA_PREVIEW}
                  onClick={publish}
                >
                  {a.profile ? "Publish in preview" : "Sign in to publish"}
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
        <aside className="editor-guide">
          <div className="guide-cover">
            <Illustration kind={resolveCover(d.art, d.category, d.title)} />
          </div>
          <span className="op-label">Your opportunity</span>
          <h3>{d.title || "Untitled opportunity"}</h3>
          <div className="op-tags">
            <span>{d.type}</span>
            <span>{d.category}</span>
          </div>
          <LocaleSummary language={d.language} country={d.country} />
          <dl className="op-definition">
            <div>
              <dt>Organizer</dt>
              <dd>{a.organizerFor(d.organizer).name}</dd>
            </div>
            <div>
              <dt>Reward</dt>
              <dd>{rewardOf(d) > 0 ? zec(rewardOf(d)) + " ZEC" : "Not set"}</dd>
            </div>
            <div>
              <dt>Deadline</dt>
              <dd>{d.deadline ? formatDate(d.deadline) : "Not set"}</dd>
            </div>
          </dl>
          <div className="guide-flow">
            <h4>{d.type === "Task" ? "Task flow" : "Contest flow"}</h4>
            {(d.type === "Task"
              ? [
                  "Applications",
                  "Contributor selected",
                  "Work delivered",
                  "Review & acceptance",
                  "Payment recorded",
                ]
              : [
                  "Entries",
                  "Review against criteria",
                  "Winners announced",
                  "Payment recorded",
                ]
            ).map((s, i) => (
              <div key={s}>
                <span>{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
        </aside>
      </div>
      <Dialog
        open={communityOpen}
        onClose={() => setCommunityOpen(false)}
        title="Create a community"
      >
        <form onSubmit={addCommunity} className="form-stack">
          <Field label="Community name">
            <input
              value={groupName}
              required
              minLength={3}
              maxLength={60}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </Field>
          <Field label="About">
            <textarea
              value={groupAbout}
              required
              minLength={15}
              onChange={(e) => setGroupAbout(e.target.value)}
            />
          </Field>
          <p>You will manage this community in the preview.</p>
          <button
            className="op-button primary"
            type="submit"
            disabled={BETA_PREVIEW}
          >
            Create community
          </button>
        </form>
      </Dialog>
    </div>
  );
}
export function Setup({ kind }: { kind: "campaign" | "community" }) {
  const a = useApp();
  const [art, setArt] = useState<string>();
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [organizer, setOrganizer] = useState(
      a.params.get("organizer") || "personal",
    ),
    [deadline, setDeadline] = useState(""),
    [format, setFormat] = useState<"Campaign" | "Hackathon">("Campaign"),
    [review, setReview] = useState(false),
    [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (BETA_PREVIEW) return;
    if (
      kind === "campaign" &&
      (!a.managed.includes(organizer) ||
        deadline <= new Date().toISOString().slice(0, 10))
    ) {
      setError("Choose your organizer and a future end date.");
      return;
    }
    if (!review) {
      setReview(true);
      return;
    }
    if (!a.profile) {
      a.setAuthOpen(true);
      return;
    }
    const id = crypto.randomUUID();
    if (kind === "community") {
      a.setLocalOrganizers((v) => [
        ...v,
        {
          id,
          name: name.trim(),
          description: description.trim(),
          mark: name
            .split(/\s+/)
            .slice(0, 2)
            .map((s) => s[0])
            .join("")
            .toUpperCase(),
          color: "gold",
          owner: a.profile!.id,
        },
      ]);
      a.go(BASE + "/communities/" + id);
    } else {
      a.setLocalCampaigns((v) => [
        ...v,
        {
          id,
          title: name.trim(),
          description: description.trim(),
          organizer,
          deadline,
          kind: format,
          owner: a.profile!.id,
          art: resolveCover(art, "Development", name),
        },
      ]);
      a.go(BASE + "/campaigns/" + id);
    }
    a.setToast(
      (kind === "community" ? "Community" : "Campaign") +
        " created in this preview.",
    );
  }
  return (
    <div className="setup-wrap">
      <Link
        to={
          kind === "campaign"
            ? BASE + "?tab=campaigns"
            : BASE + "?tab=communities"
        }
        className="op-back"
      >
        <Icon name="left" size={16} />
        {kind === "campaign" ? "Campaigns" : "Organizers"}
      </Link>
      <Heading
        title={(review ? "Review your " : "Create a ") + kind}
        description={
          kind === "campaign"
            ? "Group related tasks and contests under one goal."
            : "Create a space for the work your community organizes."
        }
      />
      {BETA_PREVIEW && (
        <BetaNote>
          {kind === "campaign"
            ? "Explore campaign setup and its cover library. Creating campaigns is coming soon."
            : "Preview the community profile. Creating communities is coming soon."}
        </BetaNote>
      )}
      <form className="editor-panel form-stack" onSubmit={submit}>
        {review ? (
          <>
            {kind === "campaign" && (
              <div className="review-cover">
                <Illustration kind={resolveCover(art, "Development", name)} />
              </div>
            )}
            <h2>{name}</h2>
            <p>{description}</p>
            {kind === "campaign" && (
              <>
                <OrganizerTag id={organizer} />
                <dl className="op-definition">
                  <div>
                    <dt>Format</dt>
                    <dd>{format}</dd>
                  </div>
                  <div>
                    <dt>Ends</dt>
                    <dd>{formatDate(deadline)}</dd>
                  </div>
                </dl>
                <div className="op-notice">
                  Rewards come from the opportunities you add to this campaign.
                </div>
              </>
            )}
            <p className="review-preview">
              This creates an example in your browser only.
            </p>
          </>
        ) : (
          <>
            <Field
              label={kind === "campaign" ? "Campaign name" : "Community name"}
            >
              <input
                required
                minLength={3}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Description">
              <textarea
                required
                minLength={20}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            {kind === "campaign" && (
              <>
                <CoverPicker value={art} title={name} onChange={setArt} />
                <Field label="Organizer">
                  <select
                    value={organizer}
                    onChange={(e) => setOrganizer(e.target.value)}
                  >
                    {a.organizers
                      .filter((o) => a.managed.includes(o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="form-pair">
                  <Field label="Format">
                    <select
                      value={format}
                      onChange={(e) =>
                        setFormat(e.target.value as "Campaign" | "Hackathon")
                      }
                    >
                      <option>Campaign</option>
                      <option>Hackathon</option>
                    </select>
                  </Field>
                  <Field label="End date">
                    <input
                      required
                      type="date"
                      defaultValue={deadline}
                      onInput={(e) => {
                        if (e.currentTarget.value)
                          setDeadline(e.currentTarget.value);
                      }}
                      onBlur={(e) => setDeadline(e.currentTarget.value)}
                    />
                  </Field>
                </div>
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="wizard-actions">
          {review ? (
            <button
              type="button"
              className="op-button"
              onClick={() => setReview(false)}
            >
              Back to editing
            </button>
          ) : (
            <span />
          )}
          <button
            className="op-button primary"
            type="submit"
            disabled={BETA_PREVIEW}
          >
            {BETA_PREVIEW
              ? "Coming soon"
              : !review
                ? "Review"
                : a.profile
                  ? "Create " + kind + " in preview"
                  : "Sign in to create"}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
