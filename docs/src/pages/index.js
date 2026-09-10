import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/">
            Explorar Documentación
          </Link>
        </div>
      </div>
    </header>
  );
}

function ResourceCard({title, description, link, icon}) {
  return (
    <div className={clsx('col col--4')}>
      <Link to={link} className={styles.cardLink}>
        <div className={styles.card}>
          <div className={styles.cardIcon}>{icon}</div>
          <h3 className={styles.cardTitle}>{title}</h3>
          <p className={styles.cardDescription}>{description}</p>
        </div>
      </Link>
    </div>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Inicio"
      description="Documentación de investigación y recursos para Ingeniería de IA">
      <HomepageHeader />
      <main>
        <section className={styles.resources}>
          <div className="container">
            <div className="row">
              <ResourceCard
                title="Recursos de Ingeniería de IA"
                description="Bibliografía, artículos, skills, cursos y herramientas para trabajar con agentes de IA."
                link="/docs/bibliografia"
                icon="📄"
              />
              <ResourceCard
                title="GSD (Get Ship Done)"
                description="Sistema de coordinación entre humanos e IA para desarrollo de software estructurado."
                link="/docs/GSD"
                icon="⚙️"
              />
              <ResourceCard
                title="Harness Engineering"
                description="Guía para construir entornos fiables que hagan que los agentes trabajen de forma consistente."
                link="/docs/harness-engineering"
                icon="🔧"
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
