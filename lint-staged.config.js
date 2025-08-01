module.exports = {
  '**/*.{js,jsx,ts,tsx}': ['next lint --fix --file', 'prettier --write'],
  '**/*.{md,json}': ['prettier --write'],
};
