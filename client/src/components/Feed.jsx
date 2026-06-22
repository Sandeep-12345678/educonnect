import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedPost, setExpandedPost] = useState(null);
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState({});

  const fetchPosts = useCallback(async (pageNum = 1) => {
    try {
      const res = await api.get('/posts', { params: { page: pageNum, limit: 10 } });
      if (pageNum === 1) {
        setPosts(res.data.posts);
      } else {
        setPosts(prev => [...prev, ...res.data.posts]);
      }
      setHasMore(pageNum < res.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch posts', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !media) return;
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', content);
      if (media) formData.append('media', media);

      const res = await api.post('/posts', formData);
      setPosts(prev => [res.data.post, ...prev]);
      setContent('');
      setMedia(null);
      setMediaPreview(null);
    } catch (err) {
      console.error('Failed to create post', err);
    } finally {
      setPosting(false);
    }
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      alert('File too large. Max 100MB.');
      return;
    }
    setMedia(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleLike = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            like_count: res.data.liked ? p.like_count + 1 : p.like_count - 1,
            liked_by_me: res.data.liked
          };
        }
        return p;
      }));
    } catch (err) {
      console.error('Failed to like', err);
    }
  };

  const fetchComments = async (postId) => {
    if (comments[postId]) {
      setExpandedPost(expandedPost === postId ? null : postId);
      return;
    }
    try {
      const res = await api.get(`/posts/${postId}`);
      setComments(prev => ({ ...prev, [postId]: res.data.comments }));
      setExpandedPost(postId);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    }
  };

  const handleComment = async (postId) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    try {
      const res = await api.post(`/posts/${postId}/comments`, { content: text });
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), res.data.comment]
      }));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      ));
    } catch (err) {
      console.error('Failed to comment', err);
    }
  };

  const handleReport = async (postId) => {
    const reason = prompt('Why are you reporting this post?');
    if (!reason) return;
    try {
      await api.post(`/posts/${postId}/report`, { reason });
      alert('Report submitted. Moderators will review it.');
    } catch (err) {
      console.error('Failed to report', err);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="feed">
      <div className="feed-header">
        <h2>📢 Feed</h2>
      </div>

      {/* Create Post */}
      <div className="create-post">
        <form onSubmit={handleCreatePost}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`What's on your mind, ${user?.username}?`}
            maxLength={2000}
          />
          {mediaPreview && (
            <div className="media-preview">
              {media?.type?.startsWith('video/') ? (
                <video src={mediaPreview} controls />
              ) : (
                <img src={mediaPreview} alt="Preview" />
              )}
              <button 
                type="button" 
                className="remove-media"
                onClick={() => { setMedia(null); setMediaPreview(null); }}
              >
                ✕
              </button>
            </div>
          )}
          <div className="actions">
            <div className="media-btns">
              <label>
                📷 Photo
                <input type="file" accept="image/*" onChange={handleMediaSelect} />
              </label>
              <label>
                🎬 Video
                <input type="file" accept="video/*" onChange={handleMediaSelect} />
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={posting || (!content.trim() && !media)}>
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Posts */}
      {posts.map(post => (
        <div key={post.id} className={`post-card ${post.is_flagged ? 'flagged' : ''}`}>
          <div className="post-header">
            <div className="post-avatar">{post.username?.[0]?.toUpperCase()}</div>
            <div className="post-user">
              <div className="name">
                {post.username}
                {post.is_flagged && <span className="badge badge-flagged" style={{marginLeft: 8}}>⚠️ Flagged</span>}
              </div>
              <div className="time">{formatTime(post.created_at)}</div>
            </div>
          </div>

          <div className="post-content">{post.content}</div>

          {post.media_url && (
            <div className="post-media">
              {post.media_type === 'video' ? (
                <video src={post.media_url} controls preload="metadata" />
              ) : (
                <img src={post.media_url} alt="Post media" loading="lazy" />
              )}
            </div>
          )}

          <div className="post-actions">
            <button 
              className={post.liked_by_me ? 'liked' : ''}
              onClick={() => handleLike(post.id)}
            >
              {post.liked_by_me ? '❤️' : '🤍'} {post.like_count}
            </button>
            <button onClick={() => fetchComments(post.id)}>
              💬 {post.comment_count}
            </button>
            <button onClick={() => handleReport(post.id)}>
              🚩 Report
            </button>
          </div>

          {/* Comments */}
          {expandedPost === post.id && (
            <div className="comments-section">
              {(comments[post.id] || []).map(c => (
                <div key={c.id} className="comment">
                  <div className="comment-avatar">{c.username?.[0]?.toUpperCase()}</div>
                  <div className="comment-body">
                    <div className="comment-user">{c.username}</div>
                    <div className="comment-text">{c.content}</div>
                  </div>
                </div>
              ))}
              <div className="comment-input">
                <input
                  type="text"
                  value={commentText[post.id] || ''}
                  onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                  placeholder="Write a comment..."
                  onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                />
                <button className="btn-primary btn-sm" onClick={() => handleComment(post.id)}>Post</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {hasMore && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <button className="btn-secondary" onClick={loadMore}>Load More</button>
        </div>
      )}

      {posts.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📝</div>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      )}
    </div>
  );
}
