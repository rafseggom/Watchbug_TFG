/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  investigationSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Inicio',
    },
    {
      type: 'category',
      label: 'Agentic Software Engineering',
      collapsed: false,
      items: [
        'investigacion',
        'AgenticSE',
      ],
    },
    {
      type: 'category',
      label: 'Referencias',
      collapsed: false,
      items: [
        'harness-engineering',
      ],
    },
    {
      type: 'category',
      label: 'GSD (Get Ship Done)',
      collapsed: false,
      items: [
        'gsd-wiki',
      ],
    },
  ],
};

module.exports = sidebars;
