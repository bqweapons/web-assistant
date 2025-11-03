import { HOST_ATTRIBUTE } from '../../core/constants.js';

let dropPreviewHost = null;
let dropPreviewSourceId = '';

export function removeDropPreviewHost() {
  if (dropPreviewHost && dropPreviewHost.isConnected) {
    dropPreviewHost.remove();
  }
  dropPreviewHost = null;
  dropPreviewSourceId = '';
}

export function ensureDropPreviewHost(element, createHost) {
  if (dropPreviewHost && dropPreviewSourceId === element.id && dropPreviewHost.isConnected) {
    return dropPreviewHost;
  }
  removeDropPreviewHost();
  if (!element || !element.id) {
    return null;
  }
  const previewElement = {
    ...element,
    id: `${element.id}-preview`,
    containerId: '',
    floating: false,
    style: { ...(element.style || {}) },
  };
  const host = createHost(previewElement);
  host.removeAttribute(HOST_ATTRIBUTE);
  host.dataset.pageAugmentorPreview = 'true';
  host.dataset.previewSourceId = element.id;
  host.style.pointerEvents = 'none';
  dropPreviewHost = host;
  dropPreviewSourceId = element.id;
  return host;
}

export function showAreaDropPreview(dropTarget, element, createHost) {
  if (!dropTarget?.content) {
    removeDropPreviewHost();
    return;
  }
  const host = ensureDropPreviewHost(element, createHost);
  if (!host) {
    return;
  }
  if (host.parentNode !== dropTarget.content) {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    dropTarget.content.appendChild(host);
  }
  resetHostPosition(host);
}

export function showDomDropPreview(placement, element, createHost) {
  if (!placement || !(placement.reference instanceof HTMLElement)) {
    removeDropPreviewHost();
    return;
  }
  const host = ensureDropPreviewHost(element, createHost);
  if (!host) {
    return;
  }
  if (host.parentNode && host.parentNode !== placement.reference && host.parentNode !== placement.reference.parentElement) {
    host.parentNode.removeChild(host);
  }
  const { reference, position } = placement;
  if (position === 'append') {
    reference.appendChild(host);
  } else if (position === 'prepend') {
    reference.insertBefore(host, reference.firstChild);
  } else if (position === 'before' && reference.parentElement) {
    reference.parentElement.insertBefore(host, reference);
  } else if (position === 'after' && reference.parentElement) {
    reference.parentElement.insertBefore(host, reference.nextSibling);
  } else {
    reference.appendChild(host);
  }
  resetHostPosition(host);
}

function resetHostPosition(host) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  host.style.position = '';
  host.style.left = '';
  host.style.top = '';
  host.style.right = '';
  host.style.bottom = '';
  host.style.zIndex = '';
  host.style.width = '';
  host.style.height = '';
}





