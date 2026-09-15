import { Moon, Sun } from 'lucide-react';
import { cn } from '../utils/cn';
import { useTheme } from '../theme/useTheme';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const nextThemeLabel = isLight ? 'oscuro' : 'claro';

  return (
    <button
      type="button"
      className={cn('theme-toggle', className)}
      onClick={toggleTheme}
      aria-label={`Cambiar a modo ${nextThemeLabel}`}
      title={`Cambiar a modo ${nextThemeLabel}`}
    >
      {isLight ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
      {showLabel ? <span>{isLight ? 'Modo claro' : 'Modo oscuro'}</span> : null}
    </button>
  );
}
