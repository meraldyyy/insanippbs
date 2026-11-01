import { Moon, Sun } from 'lucide-react';

type ThemeToggleProps = {
  darkMode: boolean;
  className?: string;
  onToggle: () => void;
};

export function ThemeToggle({ darkMode, className = '', onToggle }: ThemeToggleProps) {
  const label = darkMode ? 'Aktifkan light mode' : 'Aktifkan dark mode';

  return (
    <button
      type="button"
      className={`theme-toggle-button ${className}`.trim()}
      onClick={onToggle}
      aria-label={label}
      title={darkMode ? 'Light mode' : 'Dark mode'}
    >
      {darkMode ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
