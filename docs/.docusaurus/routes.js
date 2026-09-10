import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/watchbug-tfg/en/docs',
    component: ComponentCreator('/watchbug-tfg/en/docs', 'bc9'),
    routes: [
      {
        path: '/watchbug-tfg/en/docs',
        component: ComponentCreator('/watchbug-tfg/en/docs', '7cd'),
        routes: [
          {
            path: '/watchbug-tfg/en/docs',
            component: ComponentCreator('/watchbug-tfg/en/docs', '49f'),
            routes: [
              {
                path: '/watchbug-tfg/en/docs/',
                component: ComponentCreator('/watchbug-tfg/en/docs/', 'a20'),
                exact: true,
                sidebar: "investigationSidebar"
              },
              {
                path: '/watchbug-tfg/en/docs/bibliografia',
                component: ComponentCreator('/watchbug-tfg/en/docs/bibliografia', '66c'),
                exact: true,
                sidebar: "investigationSidebar"
              },
              {
                path: '/watchbug-tfg/en/docs/GSD',
                component: ComponentCreator('/watchbug-tfg/en/docs/GSD', 'da2'),
                exact: true,
                sidebar: "investigationSidebar"
              },
              {
                path: '/watchbug-tfg/en/docs/gsd-wiki',
                component: ComponentCreator('/watchbug-tfg/en/docs/gsd-wiki', '336'),
                exact: true,
                sidebar: "investigationSidebar"
              },
              {
                path: '/watchbug-tfg/en/docs/harness-engineering',
                component: ComponentCreator('/watchbug-tfg/en/docs/harness-engineering', '18c'),
                exact: true,
                sidebar: "investigationSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/watchbug-tfg/en/',
    component: ComponentCreator('/watchbug-tfg/en/', 'd92'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
