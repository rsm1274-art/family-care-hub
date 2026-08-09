import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RecoveryCodeModal } from './RecoveryCodeModal';

const CODE = 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789';

describe('RecoveryCodeModal', () => {
  afterEach(cleanup);

  it('shows the code', () => {
    render(<RecoveryCodeModal code={CODE} onConfirmed={() => {}} />);
    expect(screen.getByText(CODE)).toBeTruthy();
  });

  it('keeps Continue disabled until the box is ticked', () => {
    const onConfirmed = vi.fn();
    render(<RecoveryCodeModal code={CODE} onConfirmed={onConfirmed} />);

    const button = screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirmed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('copies the code to the clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<RecoveryCodeModal code={CODE} onConfirmed={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(CODE);
  });
});
