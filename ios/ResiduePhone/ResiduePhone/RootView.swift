//
//  RootView.swift
//  ResiduePhone
//
//  Top-level router. Two routes only:
//    - signed out → AuthView (login / sign up against the same
//      Mongo `users` collection the desktop uses).
//    - signed in  → SessionView (live counters + on-device Melange
//      distraction report).
//
//  PairView (the 6-digit-code flow against /api/pair/{start,claim})
//  is intentionally retained in the codebase as a manual fallback —
//  e.g. for diagnosing a phone that's signed into a different desktop
//  user, or for end-to-end testing the legacy pairing path. The
//  default flow now uses ActiveSessionPoller + /api/pair/auto, so a
//  user who signs in on their phone with the same account the desktop
//  is signed into never has to type a code.
//

import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        NavigationStack {
            Group {
                if session.user == nil {
                    AuthView()
                } else {
                    SessionView()
                }
            }
            .navigationTitle("Residue")
        }
        .tint(.purple)
    }
}
