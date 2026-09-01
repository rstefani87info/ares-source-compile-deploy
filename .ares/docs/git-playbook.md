# Git Repository Playbook

## Panoramica
Il modulo `git.js` fornisce un'interfaccia per interagire con i repository Git. Supporta operazioni comuni come clonazione, commit, push e pull, oltre a funzionalità più avanzate come la gestione dei branch e degli stash.

## Funzionalità principali
1. **Gestione repository**: Creazione, clonazione e configurazione
2. **Operazioni base**: add, commit, push, pull, fetch
3. **Gestione branch**: Creazione, checkout, merge
4. **Funzionalità avanzate**: Stash, tag, release

## Supporto per servizi Git
- GitHub
- Bitbucket
- Repository locali

## Internazionalizzazione
Il modulo supporta messaggi in più lingue (attualmente inglese e italiano) utilizzando il sistema di vocabolario integrato.

## Utilizzo tipico
1. Creare un'istanza Repository con le informazioni necessarie
2. Eseguire operazioni Git tramite i metodi forniti
3. Gestire errori e output attraverso i callback

## Considerazioni sulla sicurezza
- I token di accesso devono essere gestiti in modo sicuro
- Evitare di esporre credenziali nei log o nel codice