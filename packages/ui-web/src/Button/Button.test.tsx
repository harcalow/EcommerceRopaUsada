import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SyntheticEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y';
import { readCss } from '../test/read-css';
import { Button } from './Button';

const css = readCss('Button/Button.module.css');

describe('Button', () => {
  it('es un botón nativo con nombre accesible, type="button" por defecto y data-testid', async () => {
    const { container } = render(<Button data-testid="btn">Guardar</Button>);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('data-testid')).toBe('btn');
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(button.getAttribute('aria-disabled')).toBeNull();
    await expectNoA11yViolations(container);
  });

  it.each(['primary', 'secondary'] as const)('variante %s: sin violaciones y clase propia', async (variant) => {
    const { container } = render(<Button variant={variant}>Acción</Button>);
    expect(screen.getByRole('button').className).toContain(variant);
    await expectNoA11yViolations(container);
  });

  it('admite type="submit", fullWidth, className e icono final decorativo', () => {
    render(
      <Button type="submit" fullWidth className="extra" iconEnd={<svg data-testid="icon" />}>
        Entrar al panel
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Entrar al panel' });
    expect(button.getAttribute('type')).toBe('submit');
    expect(button.className).toContain('fullWidth');
    expect(button.className).toContain('extra');
    expect(screen.getByTestId('icon').parentElement?.getAttribute('aria-hidden')).toBe('true');
  });

  it('dispara onClick con ratón, Enter y Espacio', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ir</Button>);
    const button = screen.getByRole('button');
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('es enfocable con teclado', async () => {
    const user = userEvent.setup();
    render(<Button>Ir</Button>);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button'));
  });

  it('deshabilitado: no dispara onClick ni recibe foco', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <Button disabled onClick={onClick}>
        Ir
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(screen.getByRole('button'));
    await expectNoA11yViolations(container);
  });

  describe('en carga', () => {
    it('marca aria-busy y aria-disabled, conserva el nombre y sigue enfocable', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Button loading loadingLabel="Verificando…">
          Entrar al panel
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Entrar al panel' });
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect((button as HTMLButtonElement).disabled).toBe(false);
      await user.tab();
      expect(document.activeElement).toBe(button);
      await expectNoA11yViolations(container);
    });

    it('muestra el spinner decorativo y anuncia loadingLabel en una región de estado', () => {
      const { container } = render(
        <Button loading loadingLabel="Verificando…">
          Entrar
        </Button>,
      );
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(screen.getByRole('status').textContent).toBe('Verificando…');
    });

    it('sin carga la región de estado está vacía y no hay spinner', () => {
      const { container } = render(<Button>Entrar</Button>);
      expect(screen.getByRole('status').textContent).toBe('');
      expect(container.querySelector('svg')).toBeNull();
    });

    it('usa un anuncio por defecto si no hay loadingLabel', () => {
      render(<Button loading>Entrar</Button>);
      expect(screen.getByRole('status').textContent).toBe('Cargando…');
    });

    it('ni clic, ni Enter, ni Espacio disparan onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button loading onClick={onClick}>
          Entrar
        </Button>,
      );
      const button = screen.getByRole('button');
      await user.click(button);
      button.focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onClick).not.toHaveBeenCalled();
    });

    it('no envía el formulario (anula el submit)', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: SyntheticEvent) => { event.preventDefault(); });
      render(
        <form onSubmit={onSubmit}>
          <input aria-label="campo" />
          <Button type="submit" loading>
            Entrar
          </Button>
        </form>,
      );
      await user.click(screen.getByRole('button'));
      await user.type(screen.getByLabelText('campo'), '{Enter}');
      screen.getByRole('button').focus();
      await user.keyboard('{Enter}');
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('fuera de carga sí envía el formulario', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: SyntheticEvent) => { event.preventDefault(); });
      render(
        <form onSubmit={onSubmit}>
          <Button type="submit">Entrar</Button>
        </form>,
      );
      await user.click(screen.getByRole('button'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('estilos', () => {
    it('altura mínima de 48 px (≥ 24 px de WCAG 2.5.8) y texto largo sin desbordar', () => {
      expect(css).toMatch(/min-height:\s*3rem/);
      expect(css).toMatch(/overflow-wrap:\s*anywhere/);
      expect(css).toMatch(/max-width:\s*100%/);
    });

    it('el texto en carga usa opacity:0 y no hay colores literales', () => {
      expect(css).toMatch(/\.loading \.content\s*\{\s*opacity:\s*0/);
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    });

    it('el primario usa el par primary/on-primary y hover primary-hover', () => {
      expect(css).toMatch(/\.primary\s*\{[^}]*--color-primary\)[^}]*--color-on-primary\)/);
      expect(css).toMatch(/--color-primary-hover/);
    });
  });
});
