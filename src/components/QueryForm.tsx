import { useEffect, useId, useRef, useState } from "react";
import type { NewsCategory } from "../../shared/types.ts";

const categories: Record<NewsCategory, string> = {
  latest: "Últimas de tecnologia",
  headlines: "Destaques de tecnologia",
};

const categoryDescriptions: Record<NewsCategory, string> = {
  latest:
    "Notícias sobre tecnologia, ordenadas da mais recente para a mais antiga.",
  headlines:
    "Manchetes da categoria de tecnologia selecionadas pela GNews.",
};

const quantityOptions = [1, 5, 10];

type QuantitySelectProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

function QuantitySelect({
  value,
  onChange,
  disabled = false,
}: QuantitySelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = Math.max(0, quantityOptions.indexOf(value));

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      optionRefs.current[selectedIndex]?.focus();
    }
  }, [open, selectedIndex]);

  function closeAndFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectOption(option: number) {
    onChange(option);
    closeAndFocus();
  }

  return (
    <div
      className="custom-select"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <span id={`${id}-label`} className="custom-select__label">
        Quantidade de notícias
      </span>

      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }

          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span id={`${id}-value`}>
          {value} {value === 1 ? "notícia" : "notícias"}
        </span>

        <span
          className={`custom-select__chevron ${open ? "is-open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          id={`${id}-listbox`}
          className="custom-select__dropdown"
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {quantityOptions.map((option, index) => (
            <button
              key={option}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={value === option}
              tabIndex={-1}
              className="custom-select__option"
              onClick={() => selectOption(option)}
              onKeyDown={(event) => {
                let targetIndex: number | undefined;

                switch (event.key) {
                  case "ArrowDown":
                    targetIndex = (index + 1) % quantityOptions.length;
                    break;

                  case "ArrowUp":
                    targetIndex =
                      (index - 1 + quantityOptions.length) %
                      quantityOptions.length;
                    break;

                  case "Home":
                    targetIndex = 0;
                    break;

                  case "End":
                    targetIndex = quantityOptions.length - 1;
                    break;

                  case "Escape":
                    event.preventDefault();
                    closeAndFocus();
                    return;

                  case "Tab":
                    // Retorna ao botão antes da navegação padrão por Tab.
                    setOpen(false);
                    triggerRef.current?.focus();
                    return;
                }

                if (targetIndex !== undefined) {
                  event.preventDefault();
                  optionRefs.current[targetIndex]?.focus();
                }
              }}
            >
              <span>
                {option} {option === 1 ? "notícia" : "notícias"}
              </span>

              {value === option && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type QueryFormProps = {
  category: NewsCategory | null;
  count: number;
  loading: boolean;
  onCategoryChange: (category: NewsCategory) => void;
  onCountChange: (count: number) => void;
  onSubmit: () => void;
};

export default function QueryForm({
  category,
  count,
  loading,
  onCategoryChange,
  onCountChange,
  onSubmit,
}: QueryFormProps) {
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      aria-busy={loading}
    >
      <fieldset className="form-fieldset" disabled={loading}>
        <div className="category-grid">
          {(Object.entries(categories) as [NewsCategory, string][]).map(
            ([value, label]) => (
              <label className="category-option" key={value}>
                <input
                  type="radio"
                  name="category"
                  value={value}
                  checked={category === value}
                  onChange={() => onCategoryChange(value)}
                  required
                />

                <span className="category-card">
                  <span className="category-card__top">
                    <span className="category-card__title">{label}</span>
                    <span
                      className="category-card__indicator"
                      aria-hidden="true"
                    />
                  </span>

                  <span className="category-card__description">
                    {categoryDescriptions[value]}
                  </span>
                </span>
              </label>
            ),
          )}
        </div>
      </fieldset>

      {category && (
        <fieldset className="form-fieldset" disabled={loading}>
          <legend className="sr-only">Quantidade de notícias</legend>

          <QuantitySelect
            value={count}
            onChange={onCountChange}
            disabled={loading}
          />
        </fieldset>
      )}

      <div className="form-actions">
        <button
          className="button button--primary"
          type="submit"
          disabled={!category || loading}
        >
          Explorar notícias
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
