export type { Section, SectionGroup } from './helpSections/shared';
export { SectionIcon } from './helpSections/shared';

import type { SectionGroup } from './helpSections/shared';

import { contentOrganizationGroup } from './helpSections/contentOrganization';
import { coreFeaturesGroup } from './helpSections/coreFeatures';
import { referenceGroup } from './helpSections/reference';
import { teamWorkspaceGroup } from './helpSections/teamWorkspace';

export const sectionGroups: SectionGroup[] = [
  coreFeaturesGroup,
  contentOrganizationGroup,
  teamWorkspaceGroup,
  referenceGroup,
];

export const allSections = sectionGroups.flatMap((g) => g.sections);
