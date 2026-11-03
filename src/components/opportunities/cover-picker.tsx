import { useState } from "react";
import {
  stockCovers,
  coverTopics,
  coverLabel,
  filterCovers,
  resolveCover,
  isUploadCover,
} from "./covers";
import { Dialog } from "./frame";
import { Illustration, Icon } from "./visuals";
export function CoverPicker({
  value,
  category = "Development",
  title = "",
  onChange,
}: {
  value?: string;
  category?: string;
  title?: string;
  onChange: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [topic, setTopic] = useState("All");

  const selected = resolveCover(value, category, title),
    matches = filterCovers(query, topic);
  return (
    <div className="cover-field">
      <div className="cover-field-heading">
        <span>Cover</span>
        <small>
          {!value
            ? "Suggested"
            : isUploadCover(value)
              ? "Uploaded"
              : "Selected"}
        </small>
      </div>
      <div className="cover-current">
        <div className="cover-current-art">
          <Illustration kind={selected} />
        </div>
        <div className="cover-current-info">
          <strong>{coverLabel(selected)}</strong>
          <p>Matte paper collection · {stockCovers.length} covers</p>
          <div className="cover-actions">
            <button
              type="button"
              className="op-button"
              onClick={() => setOpen(true)}
            >
              <Icon name="grid" size={15} />
              Change cover
            </button>
            <button
              type="button"
              className="op-text"
              disabled
              title="Uploads are coming soon"
            >
              <Icon name="lock" size={15} />
              Upload image
            </button>
          </div>
          {value && (
            <button
              type="button"
              className="op-text cover-reset"
              onClick={() => onChange(undefined)}
            >
              Use suggested cover
            </button>
          )}
        </div>
      </div>
      <small className="cover-file-hint">
        Choose any stock cover. Custom uploads are coming soon.
      </small>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Choose a cover"
        className="cover-dialog"
      >
        <p className="cover-intro">
          Paper, color and Zcash. Pick a cover for your work.
        </p>
        <div className="cover-filters">
          <label className="cover-search">
            <Icon name="search" size={17} />
            <input
              aria-label="Search covers"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Cover topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option>All</option>
            {coverTopics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="cover-results">
          <span aria-live="polite">
            {matches.length} {matches.length === 1 ? "cover" : "covers"}
          </span>
          <span>Matte paper collection</span>
        </div>
        <div className="cover-grid">
          {matches.map((c) => (
            <button
              type="button"
              key={c.id}
              className="cover-choice"
              aria-label={"Choose " + c.name}
              aria-pressed={selected === c.id}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
            >
              <div>
                <Illustration kind={c.id} />
                {selected === c.id && (
                  <span className="cover-selected">
                    <Icon name="check" size={14} />
                  </span>
                )}
              </div>
              <span>
                <strong>{c.name}</strong>
                <small>{c.topic}</small>
              </span>
            </button>
          ))}
        </div>
        {!matches.length && (
          <div className="cover-empty">
            <p>No covers match this search.</p>
            <button
              type="button"
              className="op-text"
              onClick={() => {
                setQuery("");
                setTopic("All");
              }}
            >
              Show all covers
            </button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
