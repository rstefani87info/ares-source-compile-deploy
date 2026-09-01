# Git Flow Playbook

## Panoramica
Il modulo `git-flow.js` implementa il workflow Git Flow, fornendo metodi per gestire feature, release e hotfix in modo strutturato.

## Componenti principali
1. **Branch principali**:
   - `main`: Codice di produzione stabile
   - `develop`: Branch di sviluppo principale

2. **Branch temporanei**:
   - `feature/*`: Per nuove funzionalità
   - `release/*`: Per preparare rilasci
   - `hotfix/*`: Per correzioni urgenti in produzione

## Flusso di lavoro
1. **Feature**:
   - Inizia con `startFeature()`
   - Sviluppa la funzionalità
   - Completa con `finishFeature()`

2. **Release**:
   - Inizia con `startRelease()`
   - Testa e prepara per il rilascio
   - Completa con `finishRelease()`

3. **Hotfix**:
   - Inizia con `startHotfix()`
   - Correggi il problema
   - Completa con `finishHotfix()`

## Integrazione
- Richiede un'istanza della classe `Repository` da `git.js`
- Può essere integrato con sistemi CI/CD
- Supporta la gestione automatica dei tag per le versioni

## Vantaggi
- Workflow standardizzato
- Separazione chiara tra sviluppo e produzione
- Gestione strutturata delle versioni