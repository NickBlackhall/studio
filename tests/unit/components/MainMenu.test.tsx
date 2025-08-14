import { render, screen } from '../../helpers/test-utils'
import MainMenu from '@/components/MainMenu'

describe('MainMenu', () => {
  it('renders without crashing', () => {
    render(<MainMenu />)
    // Just verify the component renders - look for the background image
    expect(screen.getByAltText('Main Menu background')).toBeInTheDocument()
  })
})