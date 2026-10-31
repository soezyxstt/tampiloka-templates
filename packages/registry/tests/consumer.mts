import {
  bookingLayouts, bookingLevels, bookingPalettes, bookingPresets,
  cafePresets, capabilitiesFor, commerceFeatureIds, commerceFeatureLabels,
  commerceLevels, commerceModulesFor, commercePresets, getTemplate,
  schoolLayouts, schoolLevels, schoolModuleIds, schoolModulesFor,
  schoolPalettes, schoolPresets, schoolTemplate, schoolTypography, templates,
} from '@tampiloka/registry';

const text: string = schoolPresets.language.typography;
const flags: Record<string, boolean> = schoolModulesFor('full', 'progress-reports');
const names: readonly string[] = [...bookingLayouts, ...bookingPalettes, ...schoolLayouts, ...schoolPalettes, ...schoolTypography, ...schoolModuleIds, ...commerceFeatureIds];
const values = [bookingLevels.booking.capabilities, bookingPresets.medical.layout, cafePresets.catalog.name,
  capabilitiesFor('store'), commerceFeatureLabels.promotions, commerceLevels.store.name,
  commerceModulesFor('store'), commercePresets.market.name, getTemplate('school'),
  schoolLevels.full.capabilities, schoolTemplate.presets, templates, text, flags, names];
void values;
