import { useState } from 'react';
import { api } from '../lib/api.js';
import Modal from './Modal.jsx';
import PlaylistHero from './PlaylistHero.jsx';
import StatusBadge from './StatusBadge.jsx';
import { THEMES, getAppearance, saveAppearance, readImageAsDataUrl } from '../lib/playlistAppearance.js';

function toBase64Payload(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

export default function PlaylistEditorModal({ playlist, tab, onClose, onApplied }) {
  const [activeTab, setActiveTab] = useState(tab === 'appearance' ? 'appearance' : 'content');
  const [name, setName] = useState(playlist.name ?? '');
  const [description, setDescription] = useState(playlist.description ?? '');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(playlist.images?.[0]?.url ?? null);
  const [coverError, setCoverError] = useState(null);
  const [appearance, setAppearance] = useState(() => getAppearance(playlist.id));
  const [appearanceError, setAppearanceError] = useState(null);
  const [phase, setPhase] = useState('edit'); // edit -> review -> applying -> done -> error
  const [results, setResults] = useState(null);
  const [applyError, setApplyError] = useState(null);

  const nameChanged = name.trim() !== '' && name !== playlist.name;
  const descriptionChanged = description !== (playlist.description ?? '');
  const coverChanged = coverFile !== null;
  const hasRealChanges = nameChanged || descriptionChanged || coverChanged;

  async function handleCoverPick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverError(null);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setCoverFile(dataUrl);
      setCoverPreview(dataUrl);
    } catch (error) {
      setCoverError(error.message);
    }
  }

  function handleThemeSelect(themeKey) {
    setAppearance((previous) => ({ ...previous, themeKey, customImage: previous.customImage }));
  }

  async function handleAppearanceImagePick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAppearanceError(null);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setAppearance((previous) => ({ ...previous, customImage: dataUrl }));
    } catch (error) {
      setAppearanceError(error.message);
    }
  }

  function handleAppearanceSave() {
    const result = saveAppearance(playlist.id, appearance);
    if (!result.ok) setAppearanceError(result.error);
    else onApplied({ appearanceOnly: true });
  }

  function goToReview() {
    setPhase('review');
  }

  async function handleApply() {
    setPhase('applying');
    setApplyError(null);
    const operations = [];
    if (nameChanged) {
      operations.push({ id: 'op-rename', type: 'rename_playlist', params: { playlistId: playlist.id, newName: name.trim() } });
    }
    if (descriptionChanged) {
      operations.push({
        id: 'op-description',
        type: 'change_description',
        params: { playlistId: playlist.id, newDescription: description }
      });
    }
    if (coverChanged) {
      operations.push({
        id: 'op-cover',
        type: 'change_cover_image',
        params: { playlistId: playlist.id, base64Jpeg: toBase64Payload(coverFile) }
      });
    }

    try {
      const data = await api.executePlan({ plan: { operations }, selectedOperationIds: operations.map((operation) => operation.id) });
      setResults(data.results);
      const anyFailed = data.results.some((result) => !result.success);
      setPhase(anyFailed ? 'error' : 'done');
    } catch (error) {
      setApplyError(error);
      setPhase('error');
    }
  }

  return (
    <Modal title="Editar playlist" onClose={onClose}>
      <div className="editor-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'content'}
          className={`editor-tab${activeTab === 'content' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          Conteúdo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'appearance'}
          className={`editor-tab${activeTab === 'appearance' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          Aparência
        </button>
      </div>

      {phase === 'edit' && activeTab === 'content' && (
        <div className="editor-section">
          <div className="editor-field">
            <label htmlFor="editor-cover">Capa</label>
            <div className="editor-cover-row">
              <div className="editor-cover-preview">
                {coverPreview ? <img src={coverPreview} alt="" /> : <span className="muted">Sem capa</span>}
              </div>
              <div>
                <input id="editor-cover" type="file" accept="image/jpeg" onChange={handleCoverPick} />
                <p className="muted">JPEG, até 256KB. Esta é uma alteração real na Spotify.</p>
                {coverError && <p className="editor-inline-error">{coverError}</p>}
              </div>
            </div>
          </div>

          <div className="editor-field">
            <label htmlFor="editor-name">Nome</label>
            <input id="editor-name" type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="editor-field">
            <label htmlFor="editor-description">Descrição</label>
            <textarea
              id="editor-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <p className="muted">Nome, descrição e capa são alterações reais na sua conta Spotify.</p>

          <button type="button" className="button" disabled={!hasRealChanges} onClick={goToReview}>
            Revisar alterações
          </button>
        </div>
      )}

      {phase === 'edit' && activeTab === 'appearance' && (
        <div className="editor-section">
          <p className="muted">
            Isto personaliza apenas a visualização desta playlist dentro do Organizer. Não altera nada no aplicativo
            oficial do Spotify.
          </p>

          <div className="editor-field">
            <label>Tema</label>
            <div className="theme-grid">
              {THEMES.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  className={`theme-swatch${appearance.themeKey === theme.key ? ' is-active' : ''}`}
                  style={{ background: theme.gradient }}
                  onClick={() => handleThemeSelect(theme.key)}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div className="editor-field">
            <label htmlFor="editor-bg-image">Imagem de fundo personalizada (opcional)</label>
            <input id="editor-bg-image" type="file" accept="image/*" onChange={handleAppearanceImagePick} />
            {appearance.customImage && (
              <button
                type="button"
                className="button-secondary button"
                onClick={() => setAppearance((previous) => ({ ...previous, customImage: null }))}
              >
                Remover imagem
              </button>
            )}
            {appearanceError && <p className="editor-inline-error">{appearanceError}</p>}
          </div>

          <label className="editor-checkbox-row">
            <input
              type="checkbox"
              checked={appearance.blur}
              onChange={(event) => setAppearance((previous) => ({ ...previous, blur: event.target.checked }))}
            />
            Aplicar blur no fundo
          </label>

          <PlaylistHero
            playlist={{ ...playlist, name, description }}
            meta="Preview do visual no Organizer"
            cover={coverPreview}
            appearance={appearance}
            onEdit={() => {}}
            onPersonalize={() => {}}
          />

          <button type="button" className="button" onClick={handleAppearanceSave}>
            Salvar visual do Organizer
          </button>
        </div>
      )}

      {phase === 'review' && (
        <div className="editor-section">
          <h3>Revisar alterações reais no Spotify</h3>
          <ul className="plan-list">
            {nameChanged && (
              <li>
                <strong>Nome</strong>: {playlist.name} → {name.trim()}
              </li>
            )}
            {descriptionChanged && (
              <li>
                <strong>Descrição</strong> será atualizada
              </li>
            )}
            {coverChanged && (
              <li>
                <strong>Capa</strong> será atualizada
              </li>
            )}
          </ul>
          <div className="editor-actions-row">
            <button type="button" className="button button-secondary" onClick={() => setPhase('edit')}>
              Voltar
            </button>
            <button type="button" className="button" onClick={handleApply}>
              Aplicar no Spotify
            </button>
          </div>
        </div>
      )}

      {phase === 'applying' && <p className="muted">Enviando alterações para a Spotify...</p>}

      {(phase === 'done' || phase === 'error') && (
        <div className="editor-section">
          {applyError ? (
            <>
              <StatusBadge status="error">Falha ao aplicar</StatusBadge>
              <p className="editor-inline-error">{applyError.message}</p>
            </>
          ) : (
            results?.map((result) => (
              <div key={result.operationId} className="editor-result-row">
                <StatusBadge status={result.success ? 'success' : 'error'}>
                  {result.success ? 'Aplicado' : `Falhou: ${result.error}`}
                </StatusBadge>
                <span>{result.type}</span>
              </div>
            ))
          )}
          <div className="editor-actions-row">
            <button
              type="button"
              className="button"
              onClick={() => {
                onApplied({ appearanceOnly: false });
                onClose();
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
