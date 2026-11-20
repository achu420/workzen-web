import { render, screen } from '@testing-library/react';

import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';

describe('Tooltip labels its icon-only trigger', () => {
  it('uses the tooltip text as the accessible name of an icon-only button', () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type='button'>
            <svg aria-hidden='true' />
          </button>
        </TooltipTrigger>
        <TooltipContent>Add a card</TooltipContent>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Add a card' })).toBeTruthy();
  });

  it('leaves a button that already has its own label alone', () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type='button' aria-label='Own label'>
            <svg aria-hidden='true' />
          </button>
        </TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Own label' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tooltip text' })).toBeNull();
  });

  it('does not rename a button that shows text', () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type='button'>Save</button>
        </TooltipTrigger>
        <TooltipContent>Save the page to your workspace</TooltipContent>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('ignores a tooltip whose content is not plain text', () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type='button' data-testid='trigger'>
            <svg aria-hidden='true' />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Rich</span>
        </TooltipContent>
      </Tooltip>
    );

    expect(screen.getByTestId('trigger').getAttribute('aria-label')).toBeNull();
  });
});
