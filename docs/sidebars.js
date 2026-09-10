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
      label: 'Recursos de Ingeniería de IA',
      collapsed: false,
      items: [
        'bibliografia',
        'harness-engineering',
      ],
    },
    {
      type: 'category',
      label: 'GSD (Get Ship Done)',
      collapsed: false,
      items: [
        'GSD',
        'gsd-wiki',
      ],
    },
  ],
};

module.exports = sidebars;
