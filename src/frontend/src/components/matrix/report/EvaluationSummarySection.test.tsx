import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { EvaluationSummaryEntry } from '@/types/report';

import { EvaluationSummarySection } from './EvaluationSummarySection';

const entriesWithEval: EvaluationSummaryEntry[] = [
  {
    versionLabel: 'Main',
    modelDisplayName: 'GPT-4o',
    evaluation: {
      dimensions: {
        Accuracy: { score: 9, feedback: 'Excellent accuracy' },
        Clarity: { score: 8, feedback: 'Clear response' },
      },
      averageScore: 8.5,
    },
    averageScore: 8.5,
  },
  {
    versionLabel: 'Main',
    modelDisplayName: 'Claude 3.5',
    evaluation: {
      dimensions: {
        Accuracy: { score: 6, feedback: 'Some issues' },
        Clarity: { score: 7, feedback: 'Mostly clear' },
      },
      averageScore: 6.5,
    },
    averageScore: 6.5,
  },
];

describe('EvaluationSummarySection', () => {
  it('renders nothing when entries array is empty', () => {
    const { container } = render(<EvaluationSummarySection entries={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders table with correct column headers including dimensions', () => {
    render(<EvaluationSummarySection entries={entriesWithEval} />);

    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Average')).toBeInTheDocument();

    // Dimension names appear both in the table header and in the feedback details
    const accuracyElements = screen.getAllByText('Accuracy');
    expect(accuracyElements.length).toBeGreaterThanOrEqual(1);
    const clarityElements = screen.getAllByText('Clarity');
    expect(clarityElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders version and model labels for each row', () => {
    render(<EvaluationSummarySection entries={entriesWithEval} />);

    // Both rows show "Main" for version
    const mainCells = screen.getAllByText('Main');
    expect(mainCells).toHaveLength(2);

    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    expect(screen.getByText('Claude 3.5')).toBeInTheDocument();
  });

  it('renders score values with correct formatting', () => {
    render(<EvaluationSummarySection entries={entriesWithEval} />);

    // Scores appear in both the table and the feedback details section
    // Use getAllByText to account for duplicates
    expect(screen.getAllByText('8.5')).toHaveLength(1); // Average only in table
    expect(screen.getAllByText('6.5')).toHaveLength(1);
    expect(screen.getAllByText('9.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('8.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('6.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('7.0').length).toBeGreaterThanOrEqual(1);
  });

  it('shows dash for entries without evaluation data', () => {
    const mixed: EvaluationSummaryEntry[] = [
      entriesWithEval[0],
      {
        versionLabel: 'v2',
        modelDisplayName: 'GPT-4o',
        evaluation: null,
        averageScore: null,
      },
    ];

    render(<EvaluationSummarySection entries={mixed} />);

    // Dashes for null scores
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders feedback toggle', () => {
    render(<EvaluationSummarySection entries={entriesWithEval} />);

    expect(screen.getByText('Show evaluation feedback')).toBeInTheDocument();
  });

  it('highlights best performer with trophy icon', () => {
    const { container } = render(<EvaluationSummarySection entries={entriesWithEval} />);

    // The best scorer (8.5) should have a trophy icon — lucide adds class "lucide-trophy"
    const trophyIcons = container.querySelectorAll('.lucide-trophy');
    expect(trophyIcons).toHaveLength(1);
  });
});
