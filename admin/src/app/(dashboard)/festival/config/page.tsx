'use client'

import { useState } from 'react'

export default function FestivalConfigPage() {
  const [festival, setFestival] = useState({
    name: 'Summer Fest 2026',
    startDate: '2026-06-15',
    endDate: '2026-06-17',
    location: 'Bruxelles, Belgique',
    currencyName: 'Griffons',
    exchangeRate: 0.1,
    refundPolicy: 'manual',
    reentryPolicy: 'multiple',
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Configuration du Festival</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90">
          Enregistrer
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* General Info */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Informations générales</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nom du festival
              </label>
              <input
                type="text"
                value={festival.name}
                onChange={(e) => setFestival({ ...festival, name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date de début
                </label>
                <input
                  type="date"
                  value={festival.startDate}
                  onChange={(e) => setFestival({ ...festival, startDate: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={festival.endDate}
                  onChange={(e) => setFestival({ ...festival, endDate: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Lieu
              </label>
              <input
                type="text"
                value={festival.location}
                onChange={(e) => setFestival({ ...festival, location: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Cashless Config */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Configuration Cashless</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nom de la monnaie
              </label>
              <input
                type="text"
                value={festival.currencyName}
                onChange={(e) => setFestival({ ...festival, currencyName: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Griffons, Jetons, Tokens..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Taux de change (1 {festival.currencyName} = X €)
              </label>
              <input
                type="number"
                step="0.01"
                value={festival.exchangeRate}
                onChange={(e) => setFestival({ ...festival, exchangeRate: parseFloat(e.target.value) })}
                className="w-full rounded-lg border px-3 py-2"
              />
              <p className="mt-1 text-sm text-gray-500">
                10 € = {Math.round(10 / festival.exchangeRate)} {festival.currencyName}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Politique de remboursement
              </label>
              <select
                value={festival.refundPolicy}
                onChange={(e) => setFestival({ ...festival, refundPolicy: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="auto">Automatique</option>
                <option value="manual">Validation manuelle</option>
                <option value="none">Pas de remboursement</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Politique de re-entrée
              </label>
              <select
                value={festival.reentryPolicy}
                onChange={(e) => setFestival({ ...festival, reentryPolicy: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="single">Entrée unique</option>
                <option value="multiple">Entrées multiples (avec scan)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Preview */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Billets vendus</p>
          <p className="text-3xl font-bold">2,847</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Revenus cashless</p>
          <p className="text-3xl font-bold">45,230 €</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Entrées aujourd'hui</p>
          <p className="text-3xl font-bold">1,234</p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-sm text-gray-500">Staff actif</p>
          <p className="text-3xl font-bold">48</p>
        </div>
      </div>
    </div>
  )
}
