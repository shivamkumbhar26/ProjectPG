// src/pages/user/Home.jsx

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { searchPgs } from '../../api/search'
import Spinner from '../../components/Spinner'

export default function Home() {

    const [pgs,     setPgs]     = useState([])
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')

    const [filters, setFilters] = useState({
        city:           '',
        area:           '',
        gender_allowed: '',
        food_included:  '',
        min_price:      '',
        max_price:      ''
    })

    // Load all PGs on first render
    useEffect(() => {
        fetchPgs({})
    }, [])

    function handleChange(e) {
        setFilters({ ...filters, [e.target.name]: e.target.value })
    }

    async function fetchPgs(params) {
        setLoading(true)
        setError('')
        try {
            const res  = await searchPgs(params)
            const data = res.data
            if (data.status === 'error') {
                setError(data.data)
                return
            }
            setPgs(data.data || [])
        } catch {
            setError('Failed to load PGs. Try again.')
        } finally {
            setLoading(false)
        }
    }

    function handleSearch(e) {
        e.preventDefault()
        // Remove empty filters before sending
        const clean = Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== '')
        )
        fetchPgs(clean)
    }

    function handleReset() {
        setFilters({
            city: '', area: '', gender_allowed: '',
            food_included: '', min_price: '', max_price: ''
        })
        fetchPgs({})
    }

    return (
        <div>

            {/* Hero section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 mb-8 text-white text-center">
                <h1 className="text-3xl font-bold mb-2">Find Your Perfect PG</h1>
                <p className="text-blue-100 text-sm">Verified PG accommodations near you</p>
            </div>

            {/* Filter form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                <h2 className="text-base font-semibold text-gray-700 mb-4">Filter PGs</h2>
                <form onSubmit={handleSearch}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">

                        <input
                            name="city"
                            value={filters.city}
                            onChange={handleChange}
                            placeholder="City"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <input
                            name="area"
                            value={filters.area}
                            onChange={handleChange}
                            placeholder="Area"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />

                        <select
                            name="gender_allowed"
                            value={filters.gender_allowed}
                            onChange={handleChange}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="">Any Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="any">Any</option>
                        </select>

                        <select
                            name="food_included"
                            value={filters.food_included}
                            onChange={handleChange}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="">Food — Any</option>
                            <option value="1">Food Included</option>
                            <option value="0">No Food</option>
                        </select>

                        <input
                            name="min_price"
                            value={filters.min_price}
                            onChange={handleChange}
                            type="number"
                            placeholder="Min Price (₹)"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <input
                            name="max_price"
                            value={filters.max_price}
                            onChange={handleChange}
                            type="number"
                            placeholder="Max Price (₹)"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />

                    </div>

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium"
                        >
                            Search
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-6 py-2 rounded-lg text-sm"
                        >
                            Reset
                        </button>
                    </div>
                </form>
            </div>

            {/* Results */}
            {loading && <Spinner />}

            {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                    {error}
                </div>
            )}

            {!loading && pgs.length === 0 && !error && (
                <div className="text-center text-gray-500 py-16">
                    <p className="text-4xl mb-3">🏠</p>
                    <p className="text-lg font-medium">No PGs found</p>
                    <p className="text-sm">Try changing your filters</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pgs.map((pg) => (
                    <PgCard key={pg.id} pg={pg} />
                ))}
            </div>

        </div>
    )
}

function PgCard({ pg }) {
    return (
        <Link
            to={`/pg/${pg.id}`}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
        >
            {/* Cover image */}
            <div className="h-44 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center overflow-hidden">
                {pg.coverImage
                    ? <img src={pg.coverImage} alt={pg.title} className="w-full h-full object-cover" />
                    : <span className="text-5xl">🏠</span>
                }
            </div>

            <div className="p-4">
                <h3 className="font-semibold text-gray-800 text-base truncate">{pg.title}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{pg.area}, {pg.city}</p>

                <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${pg.gender_allowed === 'male'   ? 'bg-blue-100 text-blue-700'
                        : pg.gender_allowed === 'female' ? 'bg-pink-100 text-pink-700'
                        : 'bg-green-100 text-green-700'}`}
                    >
                        {pg.gender_allowed === 'any' ? '👥 Any' : pg.gender_allowed === 'male' ? '👨 Male' : '👩 Female'}
                    </span>
                    {pg.food_included == 1 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            🍽️ Food
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between mt-3">
                    <div>
                        <span className="text-blue-600 font-bold text-base">
                            ₹{Number(pg.min_price).toLocaleString()}
                        </span>
                        <span className="text-gray-400 text-xs"> /month</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-500 text-xs">
                        ⭐ {Number(pg.avgRating).toFixed(1)}
                        <span className="text-gray-400">({pg.reviewCount})</span>
                    </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                    {pg.totalAvailableSlots > 0
                        ? <span className="text-green-600 font-medium">✓ {pg.totalAvailableSlots} slots available</span>
                        : <span className="text-red-500 font-medium">✗ No slots available</span>
                    }
                </div>
            </div>
        </Link>
    )
}