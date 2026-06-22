import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';

export default function Chat() {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'dms'
  const [rooms, setRooms] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { type: 'room'|'dm', id/target }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchRooms();
    fetchConversations();
    setLoading(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket listeners for new messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (activeChat?.type === 'room' && msg.room === activeChat.id) {
        setMessages(prev => [...prev, msg]);
      } else if (activeChat?.type === 'dm') {
        const isRelevant = 
          (msg.sender_id === user.id && msg.receiver_id === activeChat.target.id) ||
          (msg.sender_id === activeChat.target.id && msg.receiver_id === user.id);
        if (isRelevant) setMessages(prev => [...prev, msg]);
      }
      fetchConversations(); // Refresh sidebar
    };

    const handleTyping = (data) => {
      if (activeChat?.type === 'room' && data.room === activeChat.id) {
        setTypingUser(data.username);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2000);
      } else if (activeChat?.type === 'dm' && data.dm && data.userId === activeChat.target.id) {
        setTypingUser(data.username);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2000);
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:update', handleTyping);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:update', handleTyping);
    };
  }, [socket, activeChat, user?.id]);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/chat/rooms');
      setRooms(res.data.rooms);
    } catch (err) { console.error(err); }
  };

  const fetchConversations = async () => {
    try {
      const [convRes, usersRes] = await Promise.all([
        api.get('/chat/conversations'),
        api.get('/chat/users')
      ]);
      setConversations(convRes.data.conversations || []);
      setUsers(usersRes.data.users || []);
    } catch (err) { console.error(err); }
  };

  const fetchRoomMessages = async (room) => {
    try {
      const res = await api.get(`/chat/room/${room}`);
      setMessages(res.data.messages || []);
    } catch (err) { console.error(err); }
  };

  const fetchDMMessages = async (targetUserId) => {
    try {
      const res = await api.get(`/chat/dm/${targetUserId}`);
      setMessages(res.data.messages || []);
    } catch (err) { console.error(err); }
  };

  const openRoom = (room) => {
    setActiveChat({ type: 'room', id: room.id, name: room.name });
    fetchRoomMessages(room.id);
  };

  const openDM = (target) => {
    setActiveChat({ type: 'dm', target });
    fetchDMMessages(target.id);
  };

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || !socket || !activeChat) return;

    if (activeChat.type === 'room') {
      socket.emit('message:room', { room: activeChat.id, content: trimmed }, (res) => {
        if (res?.error) alert(res.error);
      });
    } else if (activeChat.type === 'dm') {
      socket.emit('message:dm', { toUserId: activeChat.target.id, content: trimmed }, (res) => {
        if (res?.error) alert(res.error);
      });
    }

    setInput('');
  };

  const handleTypingEmit = () => {
    if (!socket || !activeChat) return;
    if (activeChat.type === 'room') {
      socket.emit('typing:room', { room: activeChat.id });
    } else if (activeChat.type === 'dm') {
      socket.emit('typing:dm', { toUserId: activeChat.target.id });
    }
  };

  const formatTime = (d) => {
    const date = new Date(d);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="chat-layout">
      {/* Chat Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h3>💬 Chats</h3>
          <div className="chat-tabs">
            <button 
              className={`chat-tab ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => setActiveTab('rooms')}
            >
              Rooms
            </button>
            <button 
              className={`chat-tab ${activeTab === 'dms' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dms'); fetchConversations(); }}
            >
              Messages
            </button>
            <button 
              className={`chat-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => { setActiveTab('users'); fetchConversations(); }}
            >
              Users
            </button>
          </div>
        </div>

        <div className="chat-list">
          {activeTab === 'rooms' && rooms.map(room => (
            <div
              key={room.id}
              className={`chat-item ${activeChat?.type === 'room' && activeChat?.id === room.id ? 'active' : ''}`}
              onClick={() => openRoom(room)}
            >
              <div className="chat-avatar" style={{ fontSize: '1.2rem' }}>
                #️⃣
              </div>
              <div className="chat-item-info">
                <div className="name">{room.name}</div>
                <div className="preview">{room.description}</div>
              </div>
            </div>
          ))}

          {activeTab === 'dms' && conversations.map(conv => (
            <div
              key={conv.user_id}
              className={`chat-item ${activeChat?.type === 'dm' && activeChat?.target?.id === conv.user_id ? 'active' : ''}`}
              onClick={() => openDM({ id: conv.user_id, username: conv.username })}
            >
              <div className="chat-avatar">{conv.username?.[0]?.toUpperCase()}</div>
              <div className="chat-item-info">
                <div className="name">
                  {conv.username}
                  {onlineUsers.has(conv.user_id) && <span className="online-badge" style={{ display: 'inline-flex', marginLeft: 6 }} />}
                </div>
                <div className="preview">{conv.last_message || 'Start a conversation'}</div>
              </div>
              {conv.unread > 0 && <div className="unread-badge">{conv.unread}</div>}
            </div>
          ))}

          {activeTab === 'users' && users.map(u => (
            <div
              key={u.id}
              className="chat-item"
              onClick={() => openDM({ id: u.id, username: u.username })}
            >
              <div className="chat-avatar">{u.username?.[0]?.toUpperCase()}</div>
              <div className="chat-item-info">
                <div className="name">
                  {u.username}
                  {onlineUsers.has(u.id) && <span className="online-badge" style={{ display: 'inline-flex', marginLeft: 6 }} />}
                </div>
                <div className="preview">{u.role}</div>
              </div>
            </div>
          ))}

          {activeTab === 'dms' && conversations.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-light)' }}>
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* Chat Main */}
      {activeChat ? (
        <div className="chat-main">
          <div className="chat-main-header">
            <h3>
              {activeChat.type === 'room' ? `# ${activeChat.name}` : activeChat.target?.username}
            </h3>
            <button className="btn-secondary btn-sm" onClick={() => setActiveChat(null)}>✕ Close</button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, i) => {
              const isMine = msg.sender_id === user.id;
              const showSender = !isMine && activeChat.type === 'room' && 
                (i === 0 || messages[i-1]?.sender_id !== msg.sender_id);
              
              return (
                <div key={msg.id || i} className={`chat-message ${isMine ? 'mine' : ''}`}>
                  {showSender && <div className="sender">{msg.sender_name}</div>}
                  <div className="bubble">{msg.content}</div>
                  <div className="time">{formatTime(msg.created_at)}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {typingUser && (
            <div className="chat-typing">{typingUser} is typing...</div>
          )}

          <div className="chat-input-area">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
              onInput={handleTypingEmit}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>➤</button>
          </div>
        </div>
      ) : (
        <div className="chat-empty">
          <div className="icon">💬</div>
          <h3>Select a conversation</h3>
          <p style={{ color: 'var(--text-light)' }}>Choose a room or start a private chat</p>
        </div>
      )}
    </div>
  );
}
