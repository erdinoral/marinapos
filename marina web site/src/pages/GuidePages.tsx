import { Link, useParams } from "react-router-dom";
import { getGuidePost, guidePosts } from "../data/guides";
import "./StaticPages.css";

export function GuideListPage() {
  return (
    <div className="container section">
      <h1 className="page-title">Rehber</h1>
      <p className="page-lead">Kurulum, kömür, temizlik ve lüle hazırlama yazıları.</p>
      <div className="guide-list">
        {guidePosts.map((post) => (
          <Link key={post.slug} to={`/rehber/${post.slug}`} className="guide-list-item">
            <div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
            </div>
            <span>
              {post.readMinutes} dk · {new Date(post.date).toLocaleDateString("tr-TR")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GuideDetailPage() {
  const { slug = "" } = useParams();
  const post = getGuidePost(slug);

  if (!post) {
    return (
      <div className="container section">
        <h1 className="page-title">Yazı bulunamadı</h1>
        <Link to="/rehber" className="btn">
          Rehbere dön
        </Link>
      </div>
    );
  }

  return (
    <article className="container section static-page">
      <nav className="breadcrumb">
        <Link to="/rehber">Rehber</Link>
        <span>/</span>
        <span>{post.title}</span>
      </nav>
      <p className="guide-meta">
        {new Date(post.date).toLocaleDateString("tr-TR")} · {post.readMinutes} dk okuma
      </p>
      <h1 className="page-title">{post.title}</h1>
      <div className="prose">
        {post.body.map((para) => (
          <p key={para}>{para}</p>
        ))}
      </div>
      <Link to="/rehber" className="section-link">
        ← Tüm yazılar
      </Link>
    </article>
  );
}
