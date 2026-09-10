// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Watchbug TFG',
  tagline: 'Documentación de investigación y recursos para Ingeniería de IA',
  favicon: 'img/favicon.ico',

  url: 'https://your-github-username.github.io',
  baseUrl: '/Watchbug_TFG/',

  organizationName: 'your-github-username',
  projectName: 'watchbug-tfg',

  onBrokenLinks: 'warn',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    localeConfigs: {
      es: {
        htmlLang: 'es-ES',
        label: 'Español',
      },
      en: {
        htmlLang: 'en-US',
        label: 'English',
      },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: '../investigation',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/your-github-username/watchbug-tfg/tree/docusaurus/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Watchbug TFG',
        logo: {
          alt: 'Watchbug Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'investigationSidebar',
            position: 'left',
            label: 'Documentación',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
          {
            href: 'https://github.com/your-github-username/watchbug-tfg',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentación',
            items: [
              {
                label: 'Bibliografía',
                to: '/docs/bibliografia',
              },
              {
                label: 'GSD',
                to: '/docs/GSD',
              },
              {
                label: 'Harness Engineering',
                to: '/docs/harness-engineering',
              },
            ],
          },
          {
            title: 'Proyecto',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/your-github-username/watchbug-tfg',
              },
              {
                label: 'Repositorio',
                href: 'https://github.com/your-github-username/watchbug-tfg/tree/develop',
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Watchbug TFG. Built with Docusaurus.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['python', 'bash', 'json'],
      },
    }),
};

module.exports = config;
