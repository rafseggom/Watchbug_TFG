// @ts-check

/**
 * Este branch (`landingpage`) se despliega en Cloudflare Pages como sitio único:
 * landing en `/` y documentación Docusaurus en `/docs` (ver scripts/build.mjs).
 * El flujo de GitHub Pages solo vive en la rama histórica `docusaurus`.
 */

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Watchbug SDK',
  tagline: 'Documentación de Watchbug: SDK de informes de errores auto-hospedado',
  favicon: 'img/logo.png',

  url: 'https://www.watchbugus.com',
  baseUrl: '/',

  organizationName: 'rafseggom',
  projectName: 'Watchbug_TFG',

  // 'ignore': este build es combinado (scripts/build.mjs). Docusaurus genera
  // /docs, pero /roadmap/, /aviso-legal/, /privacidad/, /cookies/ y /en/* los
  // aporta la landing (site/) después de la build; Docusaurus no los conoce
  // como sus propias rutas y los marcaría como rotos aunque existen en dist/.
  onBrokenLinks: 'ignore',

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
          editUrl: 'https://github.com/rafseggom/Watchbug_TFG/tree/develop/',
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
          src: 'img/logo.png',
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
            href: 'https://github.com/rafseggom/Watchbug_TFG',
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
                to: '/docs/investigacion',
              },
              {
                label: 'GSD',
                to: '/docs/gsd-wiki',
              },
              {
                label: 'Harness Engineering',
                to: '/docs/harness-engineering',
              },
            ],
          },
          {
            title: 'Watchbug',
            items: [
              {
                label: 'Inicio',
                href: '/',
              },
              {
                label: 'Roadmap interactivo',
                href: '/roadmap/',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/rafseggom/Watchbug_TFG',
              },
            ],
          },
          {
            title: 'Legal',
            items: [
              {
                label: 'Aviso legal',
                href: '/aviso-legal/',
              },
              {
                label: 'Privacidad',
                href: '/privacidad/',
              },
              {
                label: 'Cookies',
                href: '/cookies/',
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Rafael Segura Gómez · Apache 2.0 · Built with Docusaurus.`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['python', 'bash', 'json'],
      },
    }),
};

module.exports = config;
